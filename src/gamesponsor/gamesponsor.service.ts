import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  GameSponsorAssociation, 
  GameSponsorAssociationDocument 
} from './schemas/gamesponsor.schema';
import { Clue, ClueDocument } from '../clues/schemas/clue.schema';
import { Game, GameDocument } from '../games/schemas/game.schema';
import { GamesService } from '../games/games.service';
import {
  CreateGameSponsorDto,
  AssignSponsorToGameDto,
  AssignSponsorToClueDto,
  UpdateGameSponsorDto,
  ReassignSponsorDto,
  UnlockClueDto,
  BulkUnlockClueDto,
  GameSponsorQueryDto,
  GameSponsorResponseDto,
  SponsorStatsDto,
  PlayerSponsorHistoryDto,
  ValidateSponsorUnlockDto,
  GameClueStatsDto,
  ClueStatDto,
  SponsorInfoDto,
  GameClueStatsSummaryDto,
  SponsorGameHistoryDto,
  SponsorGameParticipationDto
} from './dto/game-sponsor.dto';
import { Sponsor, SponsorDocument } from '../sponsor/schemas/sponsor.schema';
import { User, UserDocument } from 'src/auth/schemas/user.schema';

@Injectable()
export class GameSponsorAssociationService {
  constructor(
    @InjectModel(GameSponsorAssociation.name) 
    private gameSponsorModel: Model<GameSponsorAssociationDocument>,
    @InjectModel(Clue.name)
    private clueModel: Model<ClueDocument>,
    @InjectModel(Game.name)
    private gameModel: Model<GameDocument>,
    private readonly gameService: GamesService,
    @InjectModel(Sponsor.name)  // ← AGREGAR ESTA LÍNEA
    private sponsorModel: Model<SponsorDocument>,
    @InjectModel(User.name)  // Necesitarás importar el schema User
    private userModel: Model<UserDocument>,
  ) {}

  // =====================================================
  // CREACIÓN Y ASIGNACIÓN
  // =====================================================

  async createGameSponsorAssociation(createDto: CreateGameSponsorDto): Promise<GameSponsorAssociationDocument> {
    try {
      // Verificar si ya existe una asociación para este sponsor en este juego
      const existingAssociation = await this.findSponsorInGame(createDto.gameId, createDto.sponsorId);
      if (existingAssociation) {
        throw new ConflictException('Sponsor already associated with this game');
      }

      // Si es sponsor de pista, validar que la pista existe y pertenece al juego
      if (createDto.clueId) {
        await this.validateClueInGame(createDto.gameId, createDto.clueId);
      }

      const gameSponsor = new this.gameSponsorModel({
        ...createDto,
        clueId: createDto.clueId ? new Types.ObjectId(createDto.clueId) : null
      });

      return await gameSponsor.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Sponsor already associated with this game');
      }
      throw error;
    }
  }

  async assignSponsorToGame(gameId: string, assignDto: AssignSponsorToGameDto): Promise<GameSponsorAssociationDocument> {
    return this.createGameSponsorAssociation({
      gameId,
      sponsorId: assignDto.sponsorId,
      clueId: null, // Sponsor general
      ...assignDto
    });
  }

  async assignSponsorToClue(gameId: string, assignDto: AssignSponsorToClueDto): Promise<GameSponsorAssociationDocument> {
    return this.createGameSponsorAssociation({
      gameId,
      sponsorId: assignDto.sponsorId,
      clueId: assignDto.clueId,
      ...assignDto
    });
  }

  // =====================================================
  // ACTUALIZACIÓN Y REASIGNACIÓN
  // =====================================================
async updateGameSponsor(gameId: string, sponsorId: string, updateDto: UpdateGameSponsorDto): Promise<GameSponsorAssociationDocument> {
  const association = await this.findSponsorInGame(gameId, sponsorId);
  if (!association) {
    throw new NotFoundException('Sponsor association not found');
  }

  // ========================================
  // VALIDACIONES ADICIONALES
  // ========================================

  // 1. Validar que el juego esté en estado 'waiting' si se va a cambiar la pista
  if (updateDto.clueId !== undefined) {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== 'waiting') {
      throw new BadRequestException('Cannot update clue association when game is not in waiting status');
    }
  }

  // 2. Si se cambia la pista, validar que existe y realizar validaciones adicionales
  if (updateDto.clueId !== undefined && updateDto.clueId !== null) {
    await this.validateClueInGame(gameId, updateDto.clueId);

    // 3. Validar que la nueva pista no esté ya asociada a otro sponsor en este juego
    const existingClueAssociation = await this.gameSponsorModel.findOne({
      gameId: gameId,
      clueId: new Types.ObjectId(updateDto.clueId),
      sponsorId: { $ne: sponsorId } // Excluir el sponsor actual
    }).exec();

    if (existingClueAssociation) {
      throw new ConflictException('This clue is already associated with another sponsor in this game');
    }

    // 4. Validar que si se cambia de sponsor general a sponsor de pista,
    // no haya conflictos con desbloqueos existentes
    if (!association.clueId && updateDto.clueId) {
      // Cambiando de general a específico - limpiar historial si existe
      if (association.unlockedFor.length > 0) {
        throw new BadRequestException('Cannot convert general sponsor with unlock history to clue-specific sponsor. Remove unlocks first or create a new sponsor association.');
      }
    }
  }

  // 5. Si se cambia de sponsor de pista a general, validar que es apropiado
  if (association.clueId && updateDto.clueId === null) {
    // Cambiar de específico a general - considerar si limpiar historial
    if (association.unlockedFor.length > 0) {
      console.warn(`Converting clue-specific sponsor ${sponsorId} to general sponsor. Clearing unlock history.`);
      // Se limpiará más abajo en el código
    }
  }

  // 6. Validar otros campos si es necesario
  if (updateDto.isActive !== undefined && !updateDto.isActive) {
    // Si se está desactivando, verificar si hay desbloqueos pendientes o restricciones
    console.log(`Deactivating sponsor ${sponsorId} in game ${gameId}`);
  }

  // ========================================
  // ACTUALIZACIÓN DE CAMPOS
  // ========================================

  // Actualizar campos básicos
  Object.assign(association, updateDto);
  
  // Manejar cambio de clueId
  if (updateDto.clueId !== undefined) {
    association.clueId = updateDto.clueId ? new Types.ObjectId(updateDto.clueId) : null;
    
    // Si se cambia de sponsor de pista a general, limpiar historial de desbloqueos
    if (association.clueId === null && association.unlockedFor.length > 0) {
      association.unlockedFor = [];
      association.totalUnlocks = 0;
      console.log(`Cleared unlock history for sponsor ${sponsorId} when converting to general sponsor`);
    }
  }

  try {
    return await association.save();
  } catch (error) {
    if (error.code === 11000) {
      throw new ConflictException('Duplicate sponsor association detected');
    }
    throw error;
  }
}
/*
  async updateGameSponsor(gameId: string, sponsorId: string, updateDto: UpdateGameSponsorDto): Promise<GameSponsorAssociationDocument> {
    const association = await this.findSponsorInGame(gameId, sponsorId);
    if (!association) {
      throw new NotFoundException('Sponsor association not found');
    }

    // Si se cambia la pista, validar que existe
    if (updateDto.clueId !== undefined && updateDto.clueId !== null) {
      await this.validateClueInGame(gameId, updateDto.clueId);
    }

    // Actualizar campos
    Object.assign(association, updateDto);
    
    if (updateDto.clueId !== undefined) {
      association.clueId = updateDto.clueId ? new Types.ObjectId(updateDto.clueId) : null;
    }

    return await association.save();
  }
*/

  async reassignSponsor(gameId: string, sponsorId: string, reassignDto: ReassignSponsorDto): Promise<GameSponsorAssociationDocument> {
    const association = await this.findSponsorInGame(gameId, sponsorId);
    if (!association) {
      throw new NotFoundException('Sponsor association not found');
    }

    // Si cambia a sponsor de pista, validar que la pista existe
    if (reassignDto.newClueId && reassignDto.newClueId !== null) {
      await this.validateClueInGame(gameId, reassignDto.newClueId);
    }

    // Si cambia de sponsor de pista a general, limpiar historial de desbloqueos
    if (association.clueId && reassignDto.newClueId === null) {
      association.unlockedFor = [];
      association.totalUnlocks = 0;
    }

    association.clueId = reassignDto.newClueId ? new Types.ObjectId(reassignDto.newClueId) : null;
    
    return await association.save();
  }

  // =====================================================
  // DESBLOQUEO DE PISTAS
  // =====================================================

  async unlockClueForPlayer(unlockDto: UnlockClueDto): Promise<any> {
    // 1. Buscar asociación sponsor-juego
    const sponsorAssociation = await this.findSponsorInGame(unlockDto.gameId, unlockDto.sponsorId);
    
    if (!sponsorAssociation) {
      throw new NotFoundException('Sponsor not found in this game');
    }

    // 2. Validar que es sponsor de pista (no general)
   if (sponsorAssociation.clueId?.toString() !== unlockDto.clueId) {
  throw new BadRequestException('Sponsor is not associated with the provided clue');
}
  
    try {
      // 5. Obtener el documento de la pista
      const clueDocument = await this.clueModel.findById(sponsorAssociation.clueId).exec();
      if (!clueDocument) {
        throw new NotFoundException('Clue not found');
      }

      // 6. Obtener el documento del juego
      const gameDocument = await this.gameModel.findById(unlockDto.gameId).exec();
      if (!gameDocument) {
        throw new NotFoundException('Game not found');
      }

      // 7. Llamar método existente handleNormalClue SIN MODIFICAR
      // Orden correcto: handleNormalClue(clue: ClueDocument, playerId: string, game: GameDocument)
      const clueResult = await this.gameService.handleNormalClue(
        clueDocument,    // ClueDocument
        unlockDto.playerId, // string
        gameDocument     // GameDocument
      );

      // 8. Si fue exitoso, actualizar sponsor
      const playerObjectId = new Types.ObjectId(unlockDto.playerId);
      
      // Verificar nuevamente que el jugador no haya usado el sponsor (por seguridad)
      const hasUsed = sponsorAssociation.unlockedFor.some(unlock => 
        unlock.playerId.equals(playerObjectId)
      );
      
      if (hasUsed) {
        throw new BadRequestException('Player has already used this sponsor');
      }
      
      // Agregar el jugador al array de desbloqueos
      sponsorAssociation.unlockedFor.push({
        playerId: playerObjectId,
        unlockedAt: new Date()
      });
      
      // Incrementar contador total
      sponsorAssociation.totalUnlocks += 1;
      
      // Guardar los cambios
      await sponsorAssociation.save();

      return {
        ...clueResult,
        unlockMethod: 'sponsor',
        sponsorId: unlockDto.sponsorId,
        sponsorName: sponsorAssociation.sponsorshipDescription || 'Sponsor'
      };
    } catch (error) {
      // Si handleNormalClue falla, no actualizar el sponsor
      throw error;
    }
  }

  async bulkUnlockClue(bulkUnlockDto: BulkUnlockClueDto): Promise<any[]> {
    const results = [];
    
    for (const playerId of bulkUnlockDto.playerIds) {
      try {
        const result = await this.unlockClueForPlayer({
          playerId,
          sponsorId: bulkUnlockDto.sponsorId,
          gameId: bulkUnlockDto.gameId
        });
        results.push({ playerId, success: true, result });
      } catch (error) {
        results.push({ playerId, success: false, error: error.message });
      }
    }

    return results;
  }

  // =====================================================
  // CONSULTAS Y BÚSQUEDAS
  // =====================================================



 async findSponsorInGame(gameId: string, sponsorId: string): Promise<GameSponsorAssociationDocument | null> {
  console.log(gameId, sponsorId);
  return await this.gameSponsorModel.findOne({
    gameId: gameId,         // <- sin convertir a ObjectId
    sponsorId: sponsorId    // <- sin convertir a ObjectId
  }).exec();
}


async getGameSponsors(gameId: string): Promise<GameSponsorAssociationDocument[]> {
  const filter = { gameId: gameId }; // Sin convertir a ObjectId
  
  return await this.gameSponsorModel
    .find(filter)
    .populate('sponsorId')
    .populate('clueId')
    .exec();
}

  async getSponsorGames(sponsorId: string): Promise<GameSponsorAssociationDocument[]> {
    return await this.gameSponsorModel
      .find({ sponsorId: new Types.ObjectId(sponsorId) })
      .populate('gameId')
      .populate('clueId')
      .exec();
  }

/**
 * Obtener historial completo de participación de un sponsor por userId
 */
async getSponsorGameHistoryByUserId(userId: string): Promise<SponsorGameHistoryDto> {
  // 1. Validar que userId sea ObjectId válido
  if (!Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('Invalid user ID format');
  }

  // 2. Buscar el usuario y verificar que tenga rol sponsor
  const user = await this.userModel.findById(userId).exec();
  if (!user) {
    throw new NotFoundException('User not found');
  }

  if (user.role !== 'sponsor') {
    throw new BadRequestException('User is not a sponsor');
  }

  if (!user.sponsorId) {
    throw new NotFoundException('User does not have an associated sponsor');
  }

  // 3. Obtener información del sponsor
  const sponsor = await this.sponsorModel.findById(user.sponsorId).exec();
  if (!sponsor) {
    throw new NotFoundException('Associated sponsor not found');
  }

  console.log(`🔍 Processing sponsor game history for userId: ${userId}, sponsorId: ${user.sponsorId}`);

  // 4. Buscar todas las asociaciones usando el sponsorId del usuario
  const associations = await this.gameSponsorModel
    .find({ sponsorId: user.sponsorId.toString() }) // Como string según tu esquema
    .populate('gameId')
    .populate('clueId')
    .sort({ createdAt: -1 })
    .exec(); // Cambiar de .lean() a .exec() para mantener los timestamps

  console.log(`📋 Found ${associations.length} game associations for sponsor`);

  // 5. Procesar datos y crear respuesta
  let totalSponsorshipAmount = 0;
  let totalUnlocks = 0;
  
  const statisticsByType = {
    main: { count: 0, totalAmount: 0 },
    secondary: { count: 0, totalAmount: 0 },
    media: { count: 0, totalAmount: 0 },
    prize: { count: 0, totalAmount: 0 }
  };

  const gameParticipations: SponsorGameParticipationDto[] = [];

  // Procesar cada asociación
  for (const association of associations) {
    const gameData = association.gameId as any; // Datos del juego poblado
    const clueData = association.clueId as any; // Datos de la pista poblada (si existe)
    const assocData = association as any; // Cast para acceder a campos de timestamp

    // Acumular estadísticas
    const amount = association.sponsorshipAmount || 0;
    totalSponsorshipAmount += amount;
    totalUnlocks += association.totalUnlocks || 0;

    // Estadísticas por tipo
    const type = association.sponsorshipType as keyof typeof statisticsByType;
    if (statisticsByType[type]) {
      statisticsByType[type].count++;
      statisticsByType[type].totalAmount += amount;
    }

    // Crear objeto de participación
    const participation: SponsorGameParticipationDto = {
      gameId: gameData._id.toString(),
      gameName: gameData.name,
      gameCreatedAt: gameData.createdAt,
      gameStatus: gameData.status,
      
      // Información de la pista (si existe)
      clueId: clueData ? clueData._id.toString() : null,
      clueTitle: clueData?.title,
      clueType: clueData?.type,
      clueOrder: clueData?.order,
      isCollaborative: clueData?.isCollaborative,
      
      // Información del sponsorship
      sponsorshipType: association.sponsorshipType,
      sponsorshipAmount: association.sponsorshipAmount,
      sponsorshipDescription: association.sponsorshipDescription,
      
      // Estadísticas de uso
      totalUnlocks: association.totalUnlocks || 0,
      isActive: association.isActive
    };

    gameParticipations.push(participation);
  }

  console.log(`📊 Processed ${gameParticipations.length} game participations`);

  // 6. Construir respuesta final
  const response: SponsorGameHistoryDto = {
    userId: userId,
    sponsorId: user.sponsorId.toString(),
    sponsorInfo: {
      nit: sponsor.nit,
      nombreEmpresa: sponsor.nombreEmpresa,
      representanteLegal: sponsor.representanteLegal,
      logo: sponsor.logo
    },
    totalGames: associations.length,
    totalSponsorshipAmount,
    totalUnlocks,
    gameParticipations: gameParticipations.sort((a, b) => 
      new Date(b.gameCreatedAt).getTime() - new Date(a.gameCreatedAt).getTime()
    ),
    statisticsByType,
    generatedAt: new Date()
  };

  console.log(`✅ Sponsor game history generated successfully for ${sponsor.nombreEmpresa}`);

  return response;
}

  async getClueSponsors(gameId: string, clueId: string): Promise<GameSponsorAssociationDocument[]> {
    return await this.gameSponsorModel
      .find({
        gameId: new Types.ObjectId(gameId),
        clueId: new Types.ObjectId(clueId)
      })
      .populate('sponsorId')
      .exec();
  }

  async getPlayerSponsorHistory(playerId: string): Promise<PlayerSponsorHistoryDto[]> {
    const sponsorAssociations = await this.gameSponsorModel
      .find({
        'unlockedFor.playerId': new Types.ObjectId(playerId)
      })
      .populate('sponsorId')
      .populate('gameId')
      .populate('clueId')
      .exec();

    const history: PlayerSponsorHistoryDto[] = [];

    for (const association of sponsorAssociations) {
      const playerUnlock = association.unlockedFor.find(
        unlock => unlock.playerId.toString() === playerId
      );

      if (playerUnlock) {
        history.push({
          playerId,
          sponsorId: association.sponsorId.toString(),
          clueId: association.clueId?.toString() || '',
          gameId: association.gameId.toString(),
          unlockedAt: playerUnlock.unlockedAt,
          // Estos campos se poblarían con datos del populate
          playerName: undefined,
          sponsorName: undefined,
          clueTitle: undefined,
          gameName: undefined
        });
      }
    }

    return history.sort((a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime());
  }

  // =====================================================
  // VALIDACIONES
  // =====================================================

  async validateSponsorUnlock(validateDto: ValidateSponsorUnlockDto): Promise<{
    canUnlock: boolean;
    reason?: string;
    sponsorInfo?: any;
  }> {
    const association = await this.findSponsorInGame(validateDto.gameId, validateDto.sponsorId);
    console.log(association)
    if (!association) {
      return { canUnlock: false, reason: 'Sponsor not found in game' };
    }


    if (!association.isClueSponsor) {
      return { canUnlock: false, reason: 'Sponsor is not associated with any clue' };
    }

    if (!association.isActive) {
      return { canUnlock: false, reason: 'Sponsor is inactive' };
    }

    if (association.hasPlayerUsedSponsor(validateDto.playerId)) {
      return { canUnlock: false, reason: 'Player has already used this sponsor' };
    }

    return {
      canUnlock: true,
      sponsorInfo: {
        sponsorId: association.sponsorId,
        clueId: association.clueId,
        sponsorshipType: association.sponsorshipType,
        totalUnlocks: association.totalUnlocks
      }
    };
  }

  async canPlayerUseSponsor(playerId: string, sponsorId: string, gameId: string): Promise<boolean> {
    const validation = await this.validateSponsorUnlock({ playerId, sponsorId, gameId });
    return validation.canUnlock;
  }

  // =====================================================
  // ESTADÍSTICAS
  // =====================================================

  async getGameSponsorStats(gameId: string): Promise<SponsorStatsDto> {
    const allSponsors = await this.gameSponsorModel.find({ gameId: new Types.ObjectId(gameId) });

    return {
      totalSponsors: allSponsors.length,
      generalSponsors: allSponsors.filter(s => s.isGeneralSponsor).length,
      clueSponsors: allSponsors.filter(s => s.isClueSponsor).length,
      totalUnlocks: allSponsors.reduce((sum, s) => sum + s.totalUnlocks, 0),
      activeSponsors: allSponsors.filter(s => s.isActive).length,
      inactiveSponsors: allSponsors.filter(s => !s.isActive).length
    };
  }

  // =====================================================
  // ELIMINACIÓN
  // =====================================================

  async removeSponsorFromGame(gameId: string, sponsorId: string): Promise<boolean> {
    const result = await this.gameSponsorModel.deleteOne({
      gameId: new Types.ObjectId(gameId),
      sponsorId: new Types.ObjectId(sponsorId)
    });

    return result.deletedCount > 0;
  }

  async deactivateSponsor(gameId: string, sponsorId: string): Promise<GameSponsorAssociationDocument> {
    const association = await this.findSponsorInGame(gameId, sponsorId);
    if (!association) {
      throw new NotFoundException('Sponsor association not found');
    }

    association.isActive = false;
    return await association.save();
  }

  // =====================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // =====================================================

  private async validateClueInGame(gameId: string, clueId: string): Promise<void> {
  console.log('=== DEBUG validateClueInGame ===');
  console.log('Received gameId:', gameId);
  console.log('Received clueId:', clueId);

  // Validar que los IDs sean ObjectId válidos
  const isValidGameId = Types.ObjectId.isValid(gameId);
  const isValidClueId = Types.ObjectId.isValid(clueId);
  console.log('Is valid gameId (ObjectId)?', isValidGameId);
  console.log('Is valid clueId (ObjectId)?', isValidClueId);

  if (!isValidClueId) {
    throw new BadRequestException('Invalid clue ID');
  }

  if (!isValidGameId) {
    throw new BadRequestException('Invalid game ID');
  }

  // Buscar la pista (Clue)
  const clue = await this.clueModel.findById(clueId).exec();
  console.log('Clue lookup result:', clue);

  if (!clue) {
    throw new NotFoundException('Clue not found');
  }

  // Buscar el juego (Game)
  const game = await this.gameModel.findById(gameId).exec();
  console.log('Game lookup result:', game);

  if (!game) {
    throw new NotFoundException('Game not found');
  }

  // Validar si la pista pertenece al juego
  if (clue.gameId) {
    console.log('Clue.gameId:', clue.gameId);
    console.log('Expected gameId:', game._id.toString());

    if (clue.gameId.toString() !== gameId) {
      throw new BadRequestException('Clue does not belong to this game');
    }
  } else {
    console.warn('Clue does not have a gameId field. Skipping game relationship validation.');
  }

  console.log('✅ Clue and game validated successfully');
}

/*
  private async validateClueInGame(gameId: string, clueId: string): Promise<void> {
    // Validar que el clueId es un ObjectId válido
    if (!Types.ObjectId.isValid(clueId)) {
      throw new BadRequestException('Invalid clue ID');
    }

    // Validar que el gameId es un ObjectId válido
    if (!Types.ObjectId.isValid(gameId)) {
      throw new BadRequestException('Invalid game ID');
    }

    // Buscar la pista
    const clue = await this.clueModel.findById(clueId).exec();
    if (!clue) {
      throw new NotFoundException('Clue not found');
    }

    // Buscar el juego para verificar que existe
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Aquí podrías agregar validación adicional si hay una relación directa entre Clue y Game
    // Por ejemplo, si el schema de Clue tiene un campo gameId:
    // if (clue.gameId.toString() !== gameId) {
    //   throw new BadRequestException('Clue does not belong to this game');
    // }
  }
    */

  
/**
 * Obtener estadísticas completas de pistas y sponsors de un juego
 */
async getGameClueStats(gameId: string): Promise<GameClueStatsDto> {
  console.log('🔍 Getting game clue stats for gameId:', gameId);

  // Validar ObjectId format
  if (!Types.ObjectId.isValid(gameId)) {
    throw new BadRequestException('Invalid game ID format');
  }

  const gameObjectId = new Types.ObjectId(gameId);

  // Verificar que el juego existe
  const game = await this.gameModel.findById(gameObjectId).exec();
  if (!game) {
    throw new NotFoundException('Game not found');
  }

  console.log('✅ Game found:', game.name);

  // 1. Buscar clues - En clues el gameId es ObjectId
  console.log('🔍 Searching clues with gameId as ObjectId');
  const clues = await this.clueModel
    .find({ gameId: gameObjectId }) // ObjectId para clues
    .sort({ order: 1 })
    .lean();

  console.log(`📋 Found ${clues.length} clues for game ${gameId}`);

  // 2. Buscar asociaciones - En asociaciones el gameId es string
  console.log('🔍 Searching sponsor associations with gameId as string');
  const sponsorAssociations = await this.gameSponsorModel
    .find({ 
      gameId: gameId, // String para asociaciones
      clueId: { $ne: null }
    })
    .populate('sponsorId')
    .lean();

  console.log(`💰 Found ${sponsorAssociations.length} sponsor associations`);

  // 3. Crear mapa de clueId -> sponsor association
  const sponsorByClueMap = new Map<string, any>();
  sponsorAssociations.forEach(association => {
    if (association.clueId) {
      sponsorByClueMap.set(association.clueId.toString(), association);
    }
  });

  console.log(`🔗 Created sponsor map with ${sponsorByClueMap.size} entries`);

  // 4. Procesar cada pista y construir estadísticas
  const clueStats: ClueStatDto[] = [];
  let totalSponsorshipAmount = 0;
  let normalClues = 0;
  let collaborativeClues = 0;
  let sponsoredClues = 0;
  let totalUnlocks = 0;

  const sponsorshipByType = {
    main: { count: 0, totalAmount: 0 },
    secondary: { count: 0, totalAmount: 0 },
    media: { count: 0, totalAmount: 0 },
    prize: { count: 0, totalAmount: 0 }
  };

  for (const clue of clues) {
    const clueId = clue._id.toString();
    const sponsorAssociation = sponsorByClueMap.get(clueId);
    
    console.log(`🔍 Processing clue ${clueId}, has sponsor: ${!!sponsorAssociation}`);

    let sponsorInfo: SponsorInfoDto | undefined;
    const hasSponsor = !!sponsorAssociation;

    if (sponsorAssociation && sponsorAssociation.sponsorId) {
      const sponsor = sponsorAssociation.sponsorId;
      const amount = sponsorAssociation.sponsorshipAmount || 0;
      
      sponsorInfo = {
        sponsorId: sponsor._id.toString(),
        nit: sponsor.nit,
        nombreEmpresa: sponsor.nombreEmpresa,
        logo: sponsor.logo,
        sponsorshipAmount: amount,
        sponsorshipType: sponsorAssociation.sponsorshipType,
        sponsorshipDescription: sponsorAssociation.sponsorshipDescription,
        totalUnlocks: sponsorAssociation.totalUnlocks || 0,
        isActive: sponsorAssociation.isActive
      };

      // Acumular estadísticas
      totalSponsorshipAmount += amount;
      sponsoredClues++;
      totalUnlocks += sponsorAssociation.totalUnlocks || 0;
      
      // Estadísticas por tipo de sponsorship
      const type = sponsorAssociation.sponsorshipType as keyof typeof sponsorshipByType;
      if (sponsorshipByType[type]) {
        sponsorshipByType[type].count++;
        sponsorshipByType[type].totalAmount += amount;
      }
    }

    // Contar tipos de pistas
    if (clue.isCollaborative) {
      collaborativeClues++;
    } else {
      normalClues++;
    }

    const clueStat: ClueStatDto = {
      clueId: clueId,
      idPista: clue.idPista,
      title: clue.title,
      description: clue.description,
      order: clue.order,
      type: clue.type,
      isCollaborative: clue.isCollaborative || false,
      requiredPlayers: clue.requiredPlayers,
      collaborativeTimeLimit: clue.collaborativeTimeLimit,
      status: clue.status,
      pointsValue: clue.pointsValue,
      sponsor: sponsorInfo,
      hasSponsor
    };

    clueStats.push(clueStat);
  }

  console.log(`📊 Processed ${clueStats.length} clues, ${sponsoredClues} with sponsors`);

  // 5. Construir resumen
  const summary: GameClueStatsSummaryDto = {
    totalClues: clues.length,
    totalSponsorshipAmount,
    normalClues,
    collaborativeClues,
    sponsoredClues,
    unSponsoredClues: clues.length - sponsoredClues,
    sponsorshipByType,
    totalUnlocks
  };

  console.log('📊 Final summary:', summary);

  // 6. Construir respuesta final
  return {
    gameId,
    summary,
    clues: clueStats.sort((a, b) => a.order - b.order),
    generatedAt: new Date()
  };
}
/**
 * Obtener solo el resumen de estadísticas de un juego
 */


/**
 * Obtener estadísticas detalladas de un sponsor específico en un juego
 */

}