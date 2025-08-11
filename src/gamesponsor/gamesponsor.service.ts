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
  ValidateSponsorUnlockDto
} from './dto/game-sponsor.dto';

@Injectable()
export class GameSponsorAssociationService {
  constructor(
    @InjectModel(GameSponsorAssociation.name) 
    private gameSponsorModel: Model<GameSponsorAssociationDocument>,
    @InjectModel(Clue.name)
    private clueModel: Model<ClueDocument>,
    @InjectModel(Game.name)
    private gameModel: Model<GameDocument>,
    private readonly gameService: GamesService
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
}