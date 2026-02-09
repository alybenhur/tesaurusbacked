import { 
  Injectable, 
  BadRequestException, 
  NotFoundException,
  ConflictException 
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  Auction, 
  AuctionDocument, 
  AuctionStatus,
  BiddableClue 
} from './schemas/auction.schema';
import { Bid, BidDocument } from './schemas/bid.schema';
import { Game, GameDocument, GameStatus } from '../games/schemas/game.schema';
import { Clue, ClueDocument } from '../clues/schemas/clue.schema';
import { Sponsor, SponsorDocument } from '../sponsor/schemas/sponsor.schema';
import { GameSponsorAssociation, GameSponsorAssociationDocument } from '../gamesponsor/schemas/gamesponsor.schema';
import { User, UserDocument } from 'src/auth/schemas/user.schema';
import { GamesService } from '../games/games.service';
import { 
  CreateAuctionDto, 
  PlaceBidDto, 
  AuctionResponseDto,
  BidHistoryResponseDto,
  BiddableClueResponseDto,
  BidResponseDto,
  SponsorActiveBidResponseDto,
  ClueInfoDto,
  BidInfoDto,
  AuctionInfoDto,
  AvailableGamesResponseDto,
  AvailableGameDto,
  CollaborativeClueDetailDto,
  ClueBidInfoDto,
  ActiveBidsResponseDto,
  ActiveGameBidDto
} from './dto/auction.dto';
import { AuctionResultsResponseDto } from './dto/auction-results.dto';

@Injectable()
export class AuctionService {
  constructor(
    @InjectModel(Auction.name) private auctionModel: Model<AuctionDocument>,
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    @InjectModel(Clue.name) private clueModel: Model<ClueDocument>,
    @InjectModel(Sponsor.name) private sponsorModel: Model<SponsorDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(GameSponsorAssociation.name) private gameSponsorModel: Model<GameSponsorAssociationDocument>,
  ) {}

  // Método helper para buscar subasta por gameId (maneja string y ObjectId)
  private async findAuctionByGameId(gameId: string): Promise<AuctionDocument | null> {
    // Validar que gameId sea un ObjectId válido
    if (!Types.ObjectId.isValid(gameId)) {
      return null; // Si no es un ObjectId válido, no puede existir la subasta
    }

    let auction;
    try {
      // Intentar buscar como ObjectId primero
      auction = await this.auctionModel.findOne({ 
        gameId: new Types.ObjectId(gameId)
      });
      
      // Si no se encuentra, intentar como string
      if (!auction) {
        auction = await this.auctionModel.findOne({ gameId: gameId });
      }
    } catch (error) {
      return null; // Si hay error en la consulta, retornar null
    }
    
    // Si se encuentra la subasta, verificar si ha expirado y actualizar status
    if (auction && auction.closingDate < new Date() && auction.status !== AuctionStatus.FINISHED) {
      try {
        auction.status = AuctionStatus.FINISHED;
        await auction.save();
      } catch (error) {
        console.error('Error actualizando status de subasta:', error);
      }
    }
    
    return auction;
  }

// ============================================================================
// MÉTODO MODIFICADO: createAuction con soporte para pistas excluidas
// UBICACIÓN: pujas.service.ts - Reemplazar método completo
// CAMBIOS:
// 1. Añade campo excludedClueAssignments al destructuring
// 2. Valida pistas excluidas y sponsors
// 3. Crea GameSponsorAssociation para pistas excluidas
// 4. Implementa rollback si falla la creación de asignaciones
// ============================================================================

async createAuction(createAuctionDto: CreateAuctionDto): Promise<AuctionResponseDto> {
  const { 
    gameId, 
    startingAmount, 
    startingAmountCollaborative,
    incrementValue, 
    closingDate,
    clueIds,  // ✅ IDs de pistas seleccionadas para subasta
    excludedClueAssignments  // ✅ NUEVO - asignaciones de pistas excluidas
  } = createAuctionDto;

  console.log('🎯 Creando subasta para juego:', gameId);
  
  // ============================================================================
  // PASO 1: VALIDACIONES BÁSICAS
  // ============================================================================
  
  // Verificar que el juego existe y está en estado waiting
  const game = await this.gameModel.findById(gameId);
  if (!game) {
    throw new NotFoundException('Juego no encontrado');
  }

  if (game.status !== GameStatus.WAITING) {
    throw new BadRequestException('Solo se pueden crear subastas para juegos en estado waiting');
  }

  // Verificar que no existe una subasta para este juego
  const existingAuction = await this.findAuctionByGameId(gameId);
  if (existingAuction) {
    throw new ConflictException('Ya existe una subasta para este juego');
  }

  // ============================================================================
  // PASO 2: VALIDAR Y PROCESAR PISTAS EXCLUIDAS
  // ============================================================================
  
  if (excludedClueAssignments && excludedClueAssignments.length > 0) {
    console.log(`\n📌 Validando ${excludedClueAssignments.length} asignaciones de pistas excluidas`);
    
    // 2.1 Validar que todos los clueIds en excludedClueAssignments existen en el juego
    const excludedClueIds = excludedClueAssignments.map(a => a.clueId);
    const excludedClues = await this.clueModel.find({
      _id: { $in: excludedClueIds.map(id => new Types.ObjectId(id)) },
      gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId
    });

    if (excludedClues.length !== excludedClueAssignments.length) {
      const foundIds = excludedClues.map(c => c._id.toString());
      const missingIds = excludedClueIds.filter(id => !foundIds.includes(id));
      
      throw new BadRequestException(
        `Algunas pistas excluidas no pertenecen al juego. ` +
        `Asignaciones: ${excludedClueAssignments.length}, Encontradas: ${excludedClues.length}. ` +
        `IDs faltantes: ${missingIds.join(', ')}`
      );
    }

    // 2.2 Validar que todos los sponsors existen
    const sponsorIds = excludedClueAssignments.map(a => a.sponsorId);
    const uniqueSponsorIds = [...new Set(sponsorIds)];
    
    const sponsors = await this.sponsorModel.find({
      _id: { $in: uniqueSponsorIds.map(id => new Types.ObjectId(id)) }
    });

    if (sponsors.length !== uniqueSponsorIds.length) {
      const foundSponsorIds = sponsors.map(s => s._id.toString());
      const missingSponsorIds = uniqueSponsorIds.filter(id => !foundSponsorIds.includes(id));
      
      throw new BadRequestException(
        `Algunos sponsors no existen en la base de datos. ` +
        `IDs faltantes: ${missingSponsorIds.join(', ')}`
      );
    }

    // 2.3 Validar que no hay duplicados en clueIds
    const uniqueClueIds = new Set(excludedClueIds);
    if (uniqueClueIds.size !== excludedClueIds.length) {
      throw new BadRequestException(
        `No se pueden hacer múltiples asignaciones para la misma pista excluida`
      );
    }

    // 2.4 Validar que no se están asignando pistas que ya están en la subasta
    if (clueIds && clueIds.length > 0) {
      const conflictingClues = excludedClueIds.filter(id => clueIds.includes(id));
      if (conflictingClues.length > 0) {
        const conflictingTitles = excludedClues
          .filter(c => conflictingClues.includes(c._id.toString()))
          .map(c => c.title);
        
        throw new BadRequestException(
          `Las siguientes pistas están en la subasta y no pueden ser asignadas a sponsors: ${conflictingTitles.join(', ')}`
        );
      }
    }

    // 2.5 Validar que no existen asignaciones previas para estas pistas
    const existingAssignments = await this.gameSponsorModel.find({
      gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId,
      clueId: { $in: excludedClueIds.map(id => new Types.ObjectId(id)) }
    });

    if (existingAssignments.length > 0) {
      const conflictingClueIds = existingAssignments.map(a => a.clueId?.toString());
      const conflictingTitles = excludedClues
        .filter(c => conflictingClueIds.includes(c._id.toString()))
        .map(c => c.title);
      
      throw new BadRequestException(
        `Las siguientes pistas ya tienen asignaciones de sponsor: ${conflictingTitles.join(', ')}`
      );
    }

    console.log('✅ Todas las validaciones de pistas excluidas pasaron correctamente');
  }

  // ============================================================================
  // PASO 3: OBTENER PISTAS PARA LA SUBASTA
  // ============================================================================
  
  let selectedClues;
  
  if (clueIds && clueIds.length > 0) {
    // CASO 1: Se especificaron pistas específicas
    console.log(`\n📋 Filtrando ${clueIds.length} pistas específicas para subasta`);
    
    const clueObjectIds = clueIds.map(id => 
      Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id
    );
    
    selectedClues = await this.clueModel.find({
      _id: { $in: clueObjectIds },
      gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId
    });

    console.log(`🔍 Pistas encontradas: ${selectedClues.length} de ${clueIds.length} solicitadas`);

    // Validar que se encontraron todas las pistas solicitadas
    if (selectedClues.length !== clueIds.length) {
      const foundIds = selectedClues.map(c => c._id.toString());
      const missingIds = clueIds.filter(id => !foundIds.includes(id));
      
      throw new BadRequestException(
        `Algunas pistas para subasta no existen o no pertenecen al juego. ` +
        `Solicitadas: ${clueIds.length}, Encontradas: ${selectedClues.length}. ` +
        `IDs faltantes: ${missingIds.join(', ')}`
      );
    }

    console.log('✅ Todas las pistas de subasta validadas correctamente');
    
  } else {
    // CASO 2: No se especificaron pistas, usar TODAS (comportamiento legacy)
    console.log('\n📋 No se especificaron pistas específicas, usando TODAS las del juego');
    
    selectedClues = await this.clueModel.find({
      gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId
    });
    
    console.log(`📊 Usando todas las pistas del juego: ${selectedClues.length}`);
  }

  // Validar que hay pistas disponibles
  if (selectedClues.length === 0) {
    throw new BadRequestException(
      clueIds && clueIds.length > 0
        ? 'No se encontraron las pistas seleccionadas en este juego'
        : 'No hay pistas disponibles en este juego para subastar'
    );
  }

  // ============================================================================
  // PASO 4: CREAR BIDDABLE CLUES CON MONTOS DIFERENCIADOS
  // ============================================================================
  
  console.log('\n💰 Configurando montos iniciales:');
  const biddableClues: BiddableClue[] = selectedClues.map(clue => {
    const isCollaborative = clue.isCollaborative || false;
    
    // Usar el monto apropiado según el tipo de pista
    const initialBid = isCollaborative 
      ? (startingAmountCollaborative || startingAmount)
      : startingAmount;

    console.log(`  - ${clue.title}: ${isCollaborative ? 'Colaborativa' : 'Individual'} -> $${initialBid}`);

    return {
      clueId: clue._id as Types.ObjectId,
      currentBid: initialBid,
      isWon: false
    };
  });

  // ============================================================================
  // PASO 5: CREAR LA SUBASTA
  // ============================================================================
  
  console.log('\n🏗️  Creando subasta...');
  const auction = new this.auctionModel({
    gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId,
    startingAmount,
    startingAmountCollaborative,
    incrementValue,
    status: AuctionStatus.ACTIVE,
    biddableClues,
    closingDate: new Date(closingDate)
  });

  let savedAuction: AuctionDocument;
  
  try {
    savedAuction = await auction.save();
    console.log(`✅ Subasta creada exitosamente con ID: ${savedAuction._id}`);
  } catch (error) {
    console.error('❌ Error creando subasta:', error);
    throw new BadRequestException('Error al crear la subasta: ' + error.message);
  }

  // ============================================================================
  // PASO 6: CREAR ASIGNACIONES PARA PISTAS EXCLUIDAS (CON ROLLBACK)
  // ============================================================================
  
  if (excludedClueAssignments && excludedClueAssignments.length > 0) {
    console.log(`\n🔗 Creando asignaciones para ${excludedClueAssignments.length} pistas excluidas...`);
    
    const associations = excludedClueAssignments.map(assignment => ({
      gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId,
      sponsorId: new Types.ObjectId(assignment.sponsorId),
      clueId: new Types.ObjectId(assignment.clueId),
      sponsorshipType: 'secondary',
      totalUnlocks: 0,
      unlockedFor: [],
      isActive: true
    }));

    try {
      const createdAssociations = await this.gameSponsorModel.insertMany(associations);
      console.log(`✅ ${createdAssociations.length} asignaciones creadas exitosamente`);
      
      // Log detallado de cada asignación
      for (const assignment of excludedClueAssignments) {
        const sponsor = await this.sponsorModel.findById(assignment.sponsorId).select('nombreEmpresa');
        const clue = await this.clueModel.findById(assignment.clueId).select('title');
        console.log(`  📍 Pista "${clue?.title}" → Sponsor "${sponsor?.nombreEmpresa}"`);
      }
      
    } catch (error) {
      console.error('❌ Error creando asignaciones de pistas excluidas:', error);
      
      // ✅ ROLLBACK: Eliminar la subasta creada
      console.log('🔄 Iniciando rollback: eliminando subasta creada...');
      
      try {
        await this.auctionModel.findByIdAndDelete(savedAuction._id);
        console.log('✅ Rollback completado: subasta eliminada');
      } catch (rollbackError) {
        console.error('❌ Error crítico en rollback:', rollbackError);
        // En este caso, la subasta quedó huérfana - se debe resolver manualmente
      }
      
      throw new BadRequestException(
        `Error al crear asignaciones de pistas excluidas: ${error.message}. ` +
        `La subasta ha sido revertida.`
      );
    }
  }

  // ============================================================================
  // PASO 7: LOGS FINALES Y RESPUESTA
  // ============================================================================
  
  console.log('\n✨ RESUMEN DE CREACIÓN:');
  if (clueIds && clueIds.length > 0) {
    console.log(`  📋 Pistas en subasta: ${selectedClues.length} específicas`);
  } else {
    console.log(`  📋 Pistas en subasta: TODAS (${selectedClues.length})`);
  }
  
  if (excludedClueAssignments && excludedClueAssignments.length > 0) {
    console.log(`  🔒 Pistas excluidas asignadas: ${excludedClueAssignments.length}`);
  }
  
  console.log(`  📅 Fecha de cierre: ${savedAuction.closingDate}`);
  console.log(`  💰 Monto inicial individual: $${startingAmount}`);
  if (startingAmountCollaborative) {
    console.log(`  👥 Monto inicial colaborativo: $${startingAmountCollaborative}`);
  }
  console.log('');

  return this.mapToAuctionResponse(savedAuction, game, selectedClues);
}

  async placeBid(gameId: string, placeBidDto: PlaceBidDto): Promise<AuctionResponseDto> {
  const { clueId, sponsorId, amount } = placeBidDto;

  console.log('=== DEBUG PLACE BID ===');
  console.log('gameId recibido:', gameId);
  console.log('gameId type:', typeof gameId);
  console.log('placeBidDto:', placeBidDto);

  // Buscar la subasta por gameId
  const auction = await this.findAuctionByGameId(gameId);
  
  if (!auction) {
    // Debug adicional para ver todas las subastas
    console.log('No se encontró la subasta. Verificando todas las subastas...');
    const allAuctions = await this.auctionModel.find({}).limit(5);
    console.log('Subastas encontradas:', allAuctions.map(a => ({
      id: a._id.toString(),
      gameId: a.gameId.toString(),
      gameIdRaw: a.gameId,
      status: a.status
    })));
    
    throw new NotFoundException('No existe una subasta activa para este juego');
  }

  console.log('Subasta encontrada:', {
    id: auction._id.toString(),
    gameId: auction.gameId.toString(),
    status: auction.status,
    closingDate: auction.closingDate
  });

  if (!Types.ObjectId.isValid(sponsorId)) {
    throw new BadRequestException('ID de usuario inválido');
  }

  // 1. Buscar el usuario y verificar que existe
  let user;
  try {
    user = await this.userModel.findById(sponsorId);
  } catch (error) {
    throw new BadRequestException('ID de usuario inválido');
  }
  
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // 2. Verificar que el usuario tiene un sponsor asociado
  if (!user.sponsorId) {
    throw new NotFoundException('El usuario no tiene un sponsor asociado');
  }

  // 3. Buscar el sponsor usando el sponsorId del usuario
  let sponsor;
  try {
    sponsor = await this.sponsorModel.findById(user.sponsorId);
  } catch (error) {
    throw new NotFoundException('ID de sponsor inválido en el usuario');
  }
  
  if (!sponsor) {
    throw new NotFoundException('Sponsor asociado no encontrado');
  }

  const sponsorIdResolved = sponsor._id.toString();

  // ✅ NUEVO: Obtener información de la pista ANTES de validar
  const clue = await this.clueModel.findById(clueId);
  if (!clue) {
    throw new NotFoundException('Pista no encontrada');
  }

  const isCollaborative = clue.isCollaborative || false;

  // Validar que se puede pujar
  await this.validateBidding(auction, gameId, sponsorIdResolved, clueId, amount);

  // Verificar que el sponsor no tiene otra puja activa en esta subasta
  let existingBid;
  try {
    existingBid = await this.bidModel.findOne({
      auctionId: auction._id,
      sponsorId: new Types.ObjectId(sponsorId)
    });
  } catch (error) {
    throw new BadRequestException('ID de sponsor inválido');
  }

  if (existingBid && existingBid.clueId.toString() !== clueId) {
    throw new BadRequestException('El sponsor ya tiene una puja activa en otra pista de esta subasta');
  }

  // Encontrar la pista en la subasta
  const biddableClueIndex = auction.biddableClues.findIndex(
    bc => bc.clueId.toString() === clueId
  );

  if (biddableClueIndex === -1) {
    throw new NotFoundException('Pista no encontrada en la subasta');
  }

  const biddableClue = auction.biddableClues[biddableClueIndex];

  // ✅ MODIFICADO: Validar el monto mínimo según tipo de pista
  let minimumBid: number;

  if (biddableClue.currentBidderId) {
    // Ya hay pujas: mínimo = puja actual + incremento
    minimumBid = biddableClue.currentBid + auction.incrementValue;
  } else {
    // No hay pujas: mínimo = monto inicial según tipo de pista
    minimumBid = isCollaborative
      ? (auction.startingAmountCollaborative || auction.startingAmount)
      : auction.startingAmount;
  }

  if (amount < minimumBid) {
    throw new BadRequestException(
      `El monto mínimo de puja es ${minimumBid}`
    );
  }

  // Actualizar la puja en la subasta
  auction.biddableClues[biddableClueIndex].currentBid = amount;
  auction.biddableClues[biddableClueIndex].currentBidderId = new Types.ObjectId(sponsorIdResolved);

  // Marcar el array como modificado para que Mongoose lo detecte
  auction.markModified('biddableClues');

  // Guardar la subasta actualizada
  await auction.save();

  // Crear o actualizar el registro de puja
  try {
    await this.bidModel.findOneAndUpdate(
      { auctionId: auction._id, sponsorId: new Types.ObjectId(sponsorId) },
      {
        auctionId: auction._id,
        clueId: new Types.ObjectId(clueId),
        sponsorId: new Types.ObjectId(sponsorIdResolved),
        amount,
        timestamp: new Date()
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    throw new BadRequestException('Error al guardar la puja');
  }

  // Retornar la subasta actualizada
  const game = await this.gameModel.findById(gameId);
  const clues = await this.clueModel.find({
    _id: { $in: auction.biddableClues.map(bc => bc.clueId) }
  });

  return this.mapToAuctionResponse(auction, game, clues);
}

  async getAuctionByGameId(gameId: string): Promise<AuctionResponseDto> {
    const auction = await this.findAuctionByGameId(gameId);
    if (!auction) {
      throw new NotFoundException('No existe una subasta para este juego');
    }

    const game = await this.gameModel.findById(gameId);
    const clues = await this.clueModel.find({
      _id: { $in: auction.biddableClues.map(bc => bc.clueId) }
    });

    return this.mapToAuctionResponse(auction, game, clues);
  }

  async getSponsorActiveBid(gameId: string, sponsorId: string): Promise<SponsorActiveBidResponseDto> {
    // Validar que sponsorId sea un ObjectId válido
    if (!Types.ObjectId.isValid(sponsorId)) {
      throw new NotFoundException('ID de sponsor inválido');
    }

    // Buscar la subasta por gameId
    const auction = await this.findAuctionByGameId(gameId);
    if (!auction) {
      throw new NotFoundException('No existe una subasta para este juego');
    }

    // Verificar que el sponsor existe - con manejo de errores
    let sponsor;
    try {
      sponsor = await this.sponsorModel.findById(sponsorId);
    } catch (error) {
      throw new NotFoundException('ID de sponsor inválido');
    }
    
    if (!sponsor) {
      throw new NotFoundException('Sponsor no encontrado');
    }

    // Buscar si el sponsor tiene una puja activa en esta subasta
    let activeBid;
    try {
      activeBid = await this.bidModel.findOne({
        auctionId: auction._id,
        sponsorId: new Types.ObjectId(sponsorId)
      });
    } catch (error) {
      throw new NotFoundException('Error al buscar pujas del sponsor');
    }

    // Verificar si puede pujar (estado de subasta y fechas)
    const now = new Date();
    const canBid = auction.status === AuctionStatus.ACTIVE && auction.closingDate > now;

    if (activeBid) {
      // El sponsor tiene una puja activa
      const clue = await this.clueModel.findById(activeBid.clueId);
      if (!clue) {
        throw new NotFoundException('Pista no encontrada');
      }

      // Encontrar la información actual de la pista en la subasta
      const biddableClue = auction.biddableClues.find(
        bc => bc.clueId.toString() === activeBid.clueId.toString()
      );

      if (!biddableClue) {
        throw new NotFoundException('Pista no encontrada en la subasta');
      }

      // Obtener información del sponsor que tiene la puja más alta actual
      let currentBidderName: string | undefined;
      if (biddableClue.currentBidderId) {
        const currentBidder = await this.sponsorModel.findById(biddableClue.currentBidderId);
        currentBidderName = currentBidder?.nombreEmpresa;
      }

      const nextMinimumBid = biddableClue.currentBid + auction.incrementValue;

      return {
        hasActiveBid: true,
        clue: {
          id: clue._id.toString(),
          title: clue.title,
          description: clue.description,
          currentBid: biddableClue.currentBid,
          isCollaborative: clue.isCollaborative,
          currentBidderId: biddableClue.currentBidderId?.toString(),
          currentBidderName
        },
        sponsorBid: {
          amount: activeBid.amount,
          timestamp: activeBid.timestamp
        },
        auction: {
          id: auction._id.toString(),
          incrementValue: auction.incrementValue,
          status: auction.status,
          closingDate: auction.closingDate
        },
        nextMinimumBid,
        canBid,
        message: canBid 
          ? 'El sponsor puede realizar una nueva puja'
          : auction.status !== AuctionStatus.ACTIVE 
            ? 'La subasta no está activa'
            : 'La subasta ha expirado'
      };
    } else {
      // El sponsor NO tiene pujas activas
      // Obtener todas las pistas disponibles para pujar
      const allClues = await this.clueModel.find({
        _id: { $in: auction.biddableClues.map(bc => bc.clueId) }
      });

      const sponsors = await this.sponsorModel.find({
        _id: { $in: auction.biddableClues
          .filter(bc => bc.currentBidderId)
          .map(bc => bc.currentBidderId) }
      });

      const availableClues: ClueInfoDto[] = auction.biddableClues.map(bc => {
        const clue = allClues.find(c => c._id.toString() === bc.clueId.toString());
        const currentBidder = sponsors.find(s => 
          bc.currentBidderId && s._id.toString() === bc.currentBidderId.toString()
        );

        return {
          id: bc.clueId.toString(),
          title: clue?.title || 'Pista no encontrada',
          description: clue?.description || '',
          currentBid: bc.currentBid,
          isCollaborative: clue?.isCollaborative || false,
          currentBidderId: bc.currentBidderId?.toString(),
          currentBidderName: currentBidder?.nombreEmpresa
        };
      });

      return {
        hasActiveBid: false,
        canBid,
        message: 'El sponsor no tiene pujas activas en esta subasta',
        availableClues,
        auction: {
          id: auction._id.toString(),
          incrementValue: auction.incrementValue,
          status: auction.status,
          closingDate: auction.closingDate
        }
      };
    }
  }

  // ============================================================================
// MÉTODO CORREGIDO: getUserAvailableGames
// UBICACIÓN: pujas.service.ts - Líneas 704-896
// CAMBIOS:
// 1. Eliminar queries countDocuments (líneas 787-794)
// 2. Calcular totalClues y collaborativeClues desde allCluesDetails
// 3. Filtrar biddableClues por sponsor antes de incluirlos en auctionInfo
// ============================================================================

async getUserAvailableGames(userId: string): Promise<AvailableGamesResponseDto> {
  // Validar que userId sea un ObjectId válido
  if (!Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('ID de usuario inválido');
  }

  // 1. Buscar el usuario y verificar que existe
  let user;
  try {
    user = await this.userModel.findById(userId);
  } catch (error) {
    throw new BadRequestException('ID de usuario inválido');
  }
  
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // 2. Verificar que el usuario tiene un sponsor asociado
  if (!user.sponsorId) {
    throw new NotFoundException('El usuario no tiene un sponsor asociado');
  }

  // 3. Buscar el sponsor usando el sponsorId del usuario
  let sponsor;
  try {
    sponsor = await this.sponsorModel.findById(user.sponsorId);
  } catch (error) {
    throw new NotFoundException('ID de sponsor inválido en el usuario');
  }
  
  if (!sponsor) {
    throw new NotFoundException('Sponsor asociado no encontrado');
  }

  const sponsorId = sponsor._id.toString();

  // 4. Buscar todos los juegos en estado waiting
  const waitingGames = await this.gameModel.find({ 
    status: GameStatus.WAITING 
  });

  if (waitingGames.length === 0) {
    return {
      availableGames: [],
      totalAvailable: 0,
      sponsorInfo: {
        id: sponsor._id.toString(),
        name: sponsor.nombreEmpresa
      }
    };
  }

  // 5. Buscar juegos donde el sponsor YA está asociado (excluir estos)
  const associatedGames = await this.gameSponsorModel.find({
    sponsorId: new Types.ObjectId(sponsorId)
  });
  const associatedGameIds = associatedGames.map(ag => ag.gameId.toString());

  // 6. Buscar subastas donde el sponsor tiene pujas activas
  const activeBids = await this.bidModel.find({
    sponsorId: new Types.ObjectId(sponsorId)
  });

  let gamesWithActiveBids: string[] = [];
  if (activeBids.length > 0) {
    const auctionsWithBids = await this.auctionModel.find({
      _id: { $in: activeBids.map(bid => bid.auctionId) }
    });
    gamesWithActiveBids = auctionsWithBids.map(auction => auction.gameId.toString());
  }

  // 7. Filtrar juegos disponibles
  const availableGames = waitingGames.filter(game => {
    const gameIdStr = game._id.toString();
    return !associatedGameIds.includes(gameIdStr) && !gamesWithActiveBids.includes(gameIdStr);
  });

  // 8. Para cada juego disponible, obtener información adicional
  const gameResults: AvailableGameDto[] = [];

  for (const game of availableGames) {
    // Verificar si hay subasta activa
    const auction = await this.auctionModel.findOne({
      gameId: game._id
    });

    // Obtener detalles de pistas (YA FILTRADAS por getAllCluesDetails)
    const allCluesDetails = await this.getAllCluesDetails(
      game._id.toString(),
      auction,
      user.sponsorId.toString()
    );

    // ============================================================================
    // ✅ CORRECCIÓN: Calcular totales desde allCluesDetails (ya filtradas)
    // En lugar de consultar la BD con countDocuments
    // ============================================================================
    
    const totalClues = allCluesDetails.length;
    const collaborativeClues = allCluesDetails.filter(
      detail => detail.isCollaborative === true
    ).length;

    console.log(`\n📊 Juego: ${game.name}`);
    console.log(`   - Total pistas en subasta: ${totalClues}`);
    console.log(`   - Pistas colaborativas en subasta: ${collaborativeClues}`);

    const gameDto: AvailableGameDto = {
      id: game._id.toString(),
      name: game.name,
      description: game.description,
      maxPlayers: game.maxPlayers,
      collaborativeClues,     // ✅ CORRECTO: Solo colaborativas en subasta
      totalClues,             // ✅ CORRECTO: Solo pistas en subasta
      hasActiveAuction: !!auction,
      createdAt: game.createdAt || new Date(),
      collaborativeCluesDetails: allCluesDetails
    };

    // Si hay subasta, agregar información incluyendo biddableClues FILTRADAS
    if (auction) {
      // ============================================================================
      // ✅ CORRECCIÓN: Filtrar biddableClues por sponsor
      // ============================================================================
      
      const availableBiddableClues = await this.filterAvailableCluesForSponsor(
        game._id.toString(),
        user.sponsorId.toString(),
        auction.biddableClues
      );

      console.log(`   - Pistas en biddableClues (filtradas): ${availableBiddableClues.length}`);

      // Obtener información de las pistas filtradas para títulos
      const clueIds = availableBiddableClues.map(bc => bc.clueId);
      const allClues = await this.clueModel.find({
        _id: { $in: clueIds }
      }).select('_id title isCollaborative type');

      // Crear map para búsqueda rápida de títulos y tipos
      const clueIdToInfo = new Map();
      allClues.forEach(clue => {
        clueIdToInfo.set(clue._id.toString(), {
          title: clue.title,
          isCollaborative: clue.isCollaborative,
          type: clue.type
        });
      });

      // Obtener sponsors que están pujando para obtener nombres
      const sponsorIds = availableBiddableClues
        .filter(bc => bc.currentBidderId)
        .map(bc => bc.currentBidderId);

      let sponsors = [];
      if (sponsorIds.length > 0) {
        sponsors = await this.sponsorModel.find({
          _id: { $in: sponsorIds }
        }).select('_id nombreEmpresa');
      }

      const sponsorIdToName = new Map();
      sponsors.forEach(sponsor => {
        sponsorIdToName.set(sponsor._id.toString(), sponsor.nombreEmpresa);
      });

      // Construir auctionInfo con biddableClues FILTRADAS
      gameDto.auctionInfo = {
        closingDate: auction.closingDate,
        startingAmount: auction.startingAmount,
        startingAmountCollaborative: auction.startingAmountCollaborative,
        incrementValue: auction.incrementValue,
        biddableClues: availableBiddableClues.map(bc => {  // ✅ USAR PISTAS FILTRADAS
          const clueInfo = clueIdToInfo.get(bc.clueId.toString()) || {
            title: 'Pista desconocida',
            isCollaborative: false,
            type: 'unknown'
          };
          
          return {
            clueId: bc.clueId.toString(),
            clueTitle: clueInfo.title,
            isCollaborative: clueInfo.isCollaborative,
            type: clueInfo.type,
            currentBid: bc.currentBid,
            currentBidderId: bc.currentBidderId?.toString(),
            currentBidderName: bc.currentBidderId ? 
              sponsorIdToName.get(bc.currentBidderId.toString()) : 
              undefined
          };
        })
      };
    }

    gameResults.push(gameDto);
  }

  // 9. Ordenar por fecha de creación (más recientes primero)
  gameResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log(`\n✅ Total juegos disponibles: ${gameResults.length}\n`);

  return {
    availableGames: gameResults,
    totalAvailable: gameResults.length,
    sponsorInfo: {
      id: sponsor._id.toString(),
      name: sponsor.nombreEmpresa
    }
  };
}

  /*
  async getUserAvailableGames(userId: string): Promise<AvailableGamesResponseDto> {
  // Validar que userId sea un ObjectId válido
  if (!Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('ID de usuario inválido');
  }

  // 1. Buscar el usuario y verificar que existe
  let user;
  try {
    user = await this.userModel.findById(userId);
  } catch (error) {
    throw new BadRequestException('ID de usuario inválido');
  }
  
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // 2. Verificar que el usuario tiene un sponsor asociado
  if (!user.sponsorId) {
    throw new NotFoundException('El usuario no tiene un sponsor asociado');
  }

  // 3. Buscar el sponsor usando el sponsorId del usuario
  let sponsor;
  try {
    sponsor = await this.sponsorModel.findById(user.sponsorId);
  } catch (error) {
    throw new NotFoundException('ID de sponsor inválido en el usuario');
  }
  
  if (!sponsor) {
    throw new NotFoundException('Sponsor asociado no encontrado');
  }

  const sponsorId = sponsor._id.toString();

  // 4. Buscar todos los juegos en estado waiting
  const waitingGames = await this.gameModel.find({ 
    status: GameStatus.WAITING 
  });

  if (waitingGames.length === 0) {
    return {
      availableGames: [],
      totalAvailable: 0,
      sponsorInfo: {
        id: sponsor._id.toString(),
        name: sponsor.nombreEmpresa
      }
    };
  }

  // 5. Buscar juegos donde el sponsor YA está asociado (excluir estos)
  const associatedGames = await this.gameSponsorModel.find({
    sponsorId: new Types.ObjectId(sponsorId)
  });
  const associatedGameIds = associatedGames.map(ag => ag.gameId.toString());

  // 6. Buscar subastas donde el sponsor tiene pujas activas
  const activeBids = await this.bidModel.find({
    sponsorId: new Types.ObjectId(sponsorId)
  });

  let gamesWithActiveBids: string[] = [];
  if (activeBids.length > 0) {
    const auctionsWithBids = await this.auctionModel.find({
      _id: { $in: activeBids.map(bid => bid.auctionId) }
    });
    gamesWithActiveBids = auctionsWithBids.map(auction => auction.gameId.toString());
  }

  // 7. Filtrar juegos disponibles
  const availableGames = waitingGames.filter(game => {
    const gameIdStr = game._id.toString();
    return !associatedGameIds.includes(gameIdStr) && !gamesWithActiveBids.includes(gameIdStr);
  });

  // 8. Para cada juego disponible, obtener información adicional
  const gameResults: AvailableGameDto[] = [];

  for (const game of availableGames) {
    // Contar TODAS las pistas
    const totalClues = await this.clueModel.countDocuments({
      gameId: game._id
    });

    const collaborativeClues = await this.clueModel.countDocuments({
      gameId: game._id,
      isCollaborative: true
    });

    // Verificar si hay subasta activa
    const auction = await this.auctionModel.findOne({
      gameId: game._id
    });

    // Obtener detalles de pistas
    const allCluesDetails = await this.getAllCluesDetails(
      game._id.toString(),
      auction,
      user.sponsorId.toString()
    );

    const gameDto: AvailableGameDto = {
      id: game._id.toString(),
      name: game.name,
      description: game.description,
      maxPlayers: game.maxPlayers,
      collaborativeClues,
      totalClues,
      hasActiveAuction: !!auction,
      createdAt: game.createdAt || new Date(),
      collaborativeCluesDetails: allCluesDetails
    };

    // Si hay subasta, agregar información incluyendo biddableClues
    if (auction) {
      // Obtener información de todos los clues para obtener títulos
      const allClues = await this.clueModel.find({
        gameId: game._id
      }).select('_id title isCollaborative type');

      // Crear map para búsqueda rápida de títulos y tipos
      const clueIdToInfo = new Map();
      allClues.forEach(clue => {
        clueIdToInfo.set(clue._id.toString(), {
          title: clue.title,
          isCollaborative: clue.isCollaborative,
          type: clue.type
        });
      });

      // Obtener sponsors que están pujando para obtener nombres
      const sponsorIds = auction.biddableClues
        .filter(bc => bc.currentBidderId)
        .map(bc => bc.currentBidderId);

      let sponsors = [];
      if (sponsorIds.length > 0) {
        sponsors = await this.sponsorModel.find({
          _id: { $in: sponsorIds }
        }).select('_id nombreEmpresa');
      }

      const sponsorIdToName = new Map();
      sponsors.forEach(sponsor => {
        sponsorIdToName.set(sponsor._id.toString(), sponsor.nombreEmpresa);
      });

      // Construir auctionInfo con biddableClues completo
      gameDto.auctionInfo = {
        closingDate: auction.closingDate,
        startingAmount: auction.startingAmount,
        startingAmountCollaborative: auction.startingAmountCollaborative,  // ✅ NUEVO CAMPO
        incrementValue: auction.incrementValue,
        biddableClues: auction.biddableClues.map(bc => {
          const clueInfo = clueIdToInfo.get(bc.clueId.toString()) || {
            title: 'Pista desconocida',
            isCollaborative: false,
            type: 'unknown'
          };
          
          return {
            clueId: bc.clueId.toString(),
            clueTitle: clueInfo.title,
            isCollaborative: clueInfo.isCollaborative,
            type: clueInfo.type,
            currentBid: bc.currentBid,
            currentBidderId: bc.currentBidderId?.toString(),
            currentBidderName: bc.currentBidderId ? 
              sponsorIdToName.get(bc.currentBidderId.toString()) : 
              undefined
          };
        })
      };
    }

    gameResults.push(gameDto);
  }

  // 9. Ordenar por fecha de creación (más recientes primero)
  gameResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    availableGames: gameResults,
    totalAvailable: gameResults.length,
    sponsorInfo: {
      id: sponsor._id.toString(),
      name: sponsor.nombreEmpresa
    }
  };
}
*/

  // Agregar este método a la clase AuctionService

async getUserActiveBids(userId: string): Promise<ActiveBidsResponseDto> {
  // Validar que userId sea un ObjectId válido
  if (!Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('ID de usuario inválido');
  }

  // 1. Buscar el usuario y verificar que existe
  let user;
  try {
    user = await this.userModel.findById(userId);
  } catch (error) {
    throw new BadRequestException('ID de usuario inválido');
  }
  
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // 2. Verificar que el usuario tiene un sponsor asociado
  if (!user.sponsorId) {
    throw new NotFoundException('El usuario no tiene un sponsor asociado');
  }

  // 3. Buscar el sponsor usando el sponsorId del usuario
  let sponsor;
  try {
    sponsor = await this.sponsorModel.findById(user.sponsorId);
  } catch (error) {
    throw new NotFoundException('ID de sponsor inválido en el usuario');
  }
  
  if (!sponsor) {
    throw new NotFoundException('Sponsor asociado no encontrado');
  }

  const sponsorId = sponsor._id.toString();

  // 4. Buscar todas las pujas activas del sponsor
  const activeBids = await this.bidModel.find({
    sponsorId: new Types.ObjectId(sponsorId)
  }).sort({ timestamp: -1 });

  if (activeBids.length === 0) {
    return {
      activeBids: [],
      totalActiveBids: 0,
      sponsorInfo: {
        id: sponsor._id.toString(),
        name: sponsor.nombreEmpresa
      }
    };
  }

  // 5. Obtener las subastas correspondientes a las pujas
  const auctionIds = activeBids.map(bid => bid.auctionId);
  const auctions = await this.auctionModel.find({
    _id: { $in: auctionIds }
  });

  // 6. Filtrar solo subastas válidas (activas y no expiradas)
  const now = new Date();
  const validAuctions = auctions.filter(auction => 
    auction.status === AuctionStatus.ACTIVE && 
    auction.closingDate > now
  );

  if (validAuctions.length === 0) {
    return {
      activeBids: [],
      totalActiveBids: 0,
      sponsorInfo: {
        id: sponsor._id.toString(),
        name: sponsor.nombreEmpresa
      }
    };
  }

  // 7. Obtener IDs de juegos de subastas válidas
  const gameIds = validAuctions.map(auction => auction.gameId);
  
  // 8. Verificar que los juegos estén en estado WAITING
  const waitingGames = await this.gameModel.find({
    _id: { $in: gameIds },
    status: GameStatus.WAITING
  });

  if (waitingGames.length === 0) {
    return {
      activeBids: [],
      totalActiveBids: 0,
      sponsorInfo: {
        id: sponsor._id.toString(),
        name: sponsor.nombreEmpresa
      }
    };
  }

  // 9. Crear map de juegos válidos para búsqueda rápida
  const validGameIds = new Set(waitingGames.map(game => game._id.toString()));
  
  // 10. Filtrar pujas que corresponden a juegos válidos
  const validBids = activeBids.filter(bid => {
    const auction = validAuctions.find(a => a._id.toString() === bid.auctionId.toString());
    return auction && validGameIds.has(auction.gameId.toString());
  });

  // 11. Obtener información adicional necesaria
  const clueIds = validBids.map(bid => bid.clueId);
  const clues = await this.clueModel.find({
    _id: { $in: clueIds }
  });

  // 12. Obtener información de sponsors que tienen pujas ganadoras
  const allBidderIds = validAuctions.flatMap(auction => 
    auction.biddableClues
      .filter(bc => bc.currentBidderId)
      .map(bc => bc.currentBidderId)
  );
  
  const allBidders = await this.sponsorModel.find({
    _id: { $in: allBidderIds }
  });

  // 13. Procesar cada puja válida y crear la respuesta
  const activeGameBids: ActiveGameBidDto[] = [];

  for (const bid of validBids) {
    const auction = validAuctions.find(a => a._id.toString() === bid.auctionId.toString());
    if (!auction) continue;

    const game = waitingGames.find(g => g._id.toString() === auction.gameId.toString());
    if (!game) continue;

    const clue = clues.find(c => c._id.toString() === bid.clueId.toString());
    if (!clue) continue;

    // Encontrar información de la pista en la subasta
    const biddableClue = auction.biddableClues.find(
      bc => bc.clueId.toString() === bid.clueId.toString()
    );
    
    if (!biddableClue) continue;

    // Determinar si el sponsor está ganando
    const isWinning = biddableClue.currentBidderId?.toString() === sponsorId;

    // Obtener información del ganador actual (si no es el sponsor)
    let currentWinnerName: string | undefined;
    if (biddableClue.currentBidderId && !isWinning) {
      const currentWinner = allBidders.find(
        bidder => bidder._id.toString() === biddableClue.currentBidderId?.toString()
      );
      currentWinnerName = currentWinner?.nombreEmpresa;
    }

    const activeGameBid: ActiveGameBidDto = {
      id: game._id.toString(),
      name: game.name,
      description: game.description,
      createdAt: game.createdAt || new Date(),
      
      clueInfo: {
        id: clue._id.toString(),
        title: clue.title,
        description: clue.description
      },
      
      sponsorBid: {
        amount: bid.amount,
        timestamp: bid.timestamp,
        isWinning
      },
      
      auctionStatus: {
        currentHighestBid: biddableClue.currentBid,
        currentWinnerId: biddableClue.currentBidderId?.toString(),
        currentWinnerName,
        nextMinimumBid: biddableClue.currentBid + auction.incrementValue,
        closingDate: auction.closingDate,
        incrementValue: auction.incrementValue
      }
    };

    activeGameBids.push(activeGameBid);
  }

  // 14. Ordenar por fecha de puja más reciente
  activeGameBids.sort((a, b) => 
    new Date(b.sponsorBid.timestamp).getTime() - new Date(a.sponsorBid.timestamp).getTime()
  );

  return {
    activeBids: activeGameBids,
    totalActiveBids: activeGameBids.length,
    sponsorInfo: {
      id: sponsor._id.toString(),
      name: sponsor.nombreEmpresa
    }
  };
}


  // ✅ NUEVO MÉTODO: Obtener detalles de pistas colaborativas con información de pujas
  private async getCollaborativeCluesDetails(
    gameId: string,
    auction: AuctionDocument | null,
    sponsorId: string
  ): Promise<CollaborativeClueDetailDto[]> {
    try {
      // 1. Obtener todas las pistas colaborativas del juego
      const collaborativeClues = await this.clueModel.find({
        gameId: new Types.ObjectId(gameId),
        isCollaborative: true
      })
      .select('_id title requiredPlayers')
      .sort({ order: 1 })
      .exec();

      if (collaborativeClues.length === 0) {
        return [];
      }

      // 2. Si no hay subasta, todas las pistas tienen valores por defecto
      if (!auction) {
        return collaborativeClues.map(clue => ({
          _id: clue._id.toString(),
          title: clue.title,
          requiredPlayers: clue.requiredPlayers || 2,
          bidInfo: {
            hasBid: false,
            currentBid: 0,
            minimumNextBid: 0,
            isUserBidding: false
          }
        }));
      }

      // 3. Crear map de pistas en subasta para búsqueda rápida
      const biddableCluesMap = new Map();
      auction.biddableClues.forEach(bc => {
        biddableCluesMap.set(bc.clueId.toString(), bc);
      });

      // 4. Obtener nombres de sponsors que están pujando
      const sponsorIds = auction.biddableClues
        .filter(bc => bc.currentBidderId)
        .map(bc => bc.currentBidderId);

      const sponsors = await this.sponsorModel.find({
        _id: { $in: sponsorIds }
      }).select('_id nombreEmpresa').exec();

      const sponsorsMap = new Map();
      sponsors.forEach(sponsor => {
        sponsorsMap.set(sponsor._id.toString(), sponsor.nombreEmpresa);
      });

      // 5. Combinar información de pistas con información de pujas
      const result: CollaborativeClueDetailDto[] = collaborativeClues.map(clue => {
        const clueIdStr = clue._id.toString();
        const biddableClue = biddableCluesMap.get(clueIdStr);

        let bidInfo: ClueBidInfoDto;

        if (biddableClue) {
          // Hay información de puja para esta pista
          const currentBidderId = biddableClue.currentBidderId?.toString();
          const currentBidderName = currentBidderId ? sponsorsMap.get(currentBidderId) : undefined;
          const isUserBidding = currentBidderId === sponsorId;

          bidInfo = {
            hasBid: !!currentBidderId,
            currentBid: biddableClue.currentBid,
            currentBidderId,
            currentBidderName,
            minimumNextBid: biddableClue.currentBid + auction.incrementValue,
            isUserBidding
          };
        } else {
          // Pista colaborativa no está en subasta (caso raro, pero posible)
          bidInfo = {
            hasBid: false,
            currentBid: auction.startingAmount,
            minimumNextBid: auction.startingAmount + auction.incrementValue,
            isUserBidding: false
          };
        }

        return {
          _id: clueIdStr,
          title: clue.title,
          requiredPlayers: clue.requiredPlayers || 2,
          bidInfo
        };
      });

      return result;

    } catch (error) {
      console.error('Error obteniendo detalles de pistas colaborativas:', error);
      return [];
    }
  }

  async getBidHistory(gameId: string): Promise<BidHistoryResponseDto> {
    const auction = await this.findAuctionByGameId(gameId);
    if (!auction) {
      throw new NotFoundException('No existe una subasta para este juego');
    }

    const bids = await this.bidModel
      .find({ auctionId: auction._id })
      .sort({ timestamp: -1 });

    const game = await this.gameModel.findById(gameId);
    const clues = await this.clueModel.find({
      _id: { $in: bids.map(bid => bid.clueId) }
    });
    const sponsors = await this.sponsorModel.find({
      _id: { $in: bids.map(bid => bid.sponsorId) }
    });

    const bidResponses: BidResponseDto[] = bids.map(bid => {
      const clue = clues.find(c => c._id.toString() === bid.clueId.toString());
      const sponsor = sponsors.find(s => s._id.toString() === bid.sponsorId.toString());

      return {
        id: bid._id.toString(),
        clueId: bid.clueId.toString(),
        clueTitle: clue?.title || 'Pista no encontrada',
        sponsorId: bid.sponsorId.toString(),
        sponsorName: sponsor?.nombreEmpresa || 'Sponsor no encontrado',
        amount: bid.amount,
        timestamp: bid.timestamp
      };
    });

    return {
      auctionId: auction._id.toString(),
      gameId: gameId,
      gameName: game?.name || 'Juego no encontrado',
      bids: bidResponses,
      totalBids: bids.length
    };
  }

 private async validateBidding(
  auction: AuctionDocument,
  gameId: string,
  sponsorId: string,
  clueId: string,
  amount: number
): Promise<void> {
  // Verificar que la subasta está activa
  if (auction.status !== AuctionStatus.ACTIVE) {
    throw new BadRequestException('La subasta no está activa');
  }

  // Verificar que no ha expirado
  if (new Date() >= auction.closingDate) {
    throw new BadRequestException('La subasta ha expirado');
  }

  // Verificar que el juego está en estado waiting
  const game = await this.gameModel.findById(gameId);
  if (!game || game.status !== GameStatus.WAITING) {
    throw new BadRequestException('Solo se puede pujar cuando el juego está en estado waiting');
  }

  // Validar que sponsorId y clueId sean ObjectIds válidos
  if (!Types.ObjectId.isValid(sponsorId)) {
    throw new BadRequestException('ID de sponsor inválido');
  }

  if (!Types.ObjectId.isValid(clueId)) {
    throw new BadRequestException('ID de pista inválido');
  }

  // Verificar que el sponsor existe - con manejo de errores
  let sponsor;
  try {
    sponsor = await this.sponsorModel.findById(sponsorId);
  } catch (error) {
    throw new NotFoundException('ID de sponsor inválido');
  }
  
  if (!sponsor) {
    throw new NotFoundException('Sponsor no encontrado');
  }

  // Verificar que la pista existe - con manejo de errores
  let clue;
  try {
    clue = await this.clueModel.findById(clueId);
  } catch (error) {
    throw new NotFoundException('ID de pista inválido');
  }

  if (!clue) {
    throw new NotFoundException('Pista no encontrada');
  }

  // ✅ MODIFICACIÓN: ELIMINAR validación que restringe a pistas colaborativas
  // if (!clue.isCollaborative) {
  //   throw new BadRequestException('Solo se puede pujar por pistas colaborativas');
  // }
}

  private async mapToAuctionResponse(
    auction: AuctionDocument,
    game: GameDocument,
    clues: ClueDocument[]
  ): Promise<AuctionResponseDto> {
    const sponsors = await this.sponsorModel.find({
      _id: { $in: auction.biddableClues
        .filter(bc => bc.currentBidderId)
        .map(bc => bc.currentBidderId) }
    });

    const biddableCluesResponse: BiddableClueResponseDto[] = auction.biddableClues.map(bc => {
      const clue = clues.find(c => c._id.toString() === bc.clueId.toString());
      const sponsor = sponsors.find(s => 
        bc.currentBidderId && s._id.toString() === bc.currentBidderId.toString()
      );

      return {
        clueId: bc.clueId.toString(),
        clueTitle: clue?.title || 'Pista no encontrada',
        currentBid: bc.currentBid,
        currentBidderId: bc.currentBidderId?.toString(),
        currentBidderName: sponsor?.nombreEmpresa,
        isWon: bc.isWon
      };
    });

    return {
      id: auction._id.toString(),
      gameId: auction.gameId.toString(),
      gameName: game?.name || 'Juego no encontrado',
      startingAmount: auction.startingAmount,
      incrementValue: auction.incrementValue,
      status: auction.status,
      biddableClues: biddableCluesResponse,
      closingDate: auction.closingDate,
      createdAt: auction.createdAt,
      updatedAt: auction.updatedAt
    };
  }

  // Agregar este método a la clase AuctionService después del método placeBid

async updateBid(gameId: string, updateBidDto: PlaceBidDto): Promise<AuctionResponseDto> {
  const { clueId, sponsorId, amount } = updateBidDto;

  console.log('=== DEBUG UPDATE BID ===');
  console.log('gameId recibido:', gameId);
  console.log('gameId type:', typeof gameId);
  console.log('updateBidDto:', updateBidDto);

  // Buscar la subasta por gameId (reutilizar método helper)
  const auction = await this.findAuctionByGameId(gameId);
  
  if (!auction) {
    // Debug adicional para ver todas las subastas
    console.log('No se encontró la subasta. Verificando todas las subastas...');
    const allAuctions = await this.auctionModel.find({}).limit(5);
    console.log('Subastas encontradas:', allAuctions.map(a => ({
      id: a._id.toString(),
      gameId: a.gameId.toString(),
      gameIdRaw: a.gameId,
      status: a.status
    })));
    
    throw new NotFoundException('No existe una subasta activa para este juego');
  }

  console.log('Subasta encontrada:', {
    id: auction._id.toString(),
    gameId: auction.gameId.toString(),
    status: auction.status,
    closingDate: auction.closingDate
  });

  if (!Types.ObjectId.isValid(sponsorId)) {
    throw new BadRequestException('ID de usuario inválido');
  }

  // 1. Buscar el usuario y verificar que existe (reutilizar código de placeBid)
  let user;
  try {
    user = await this.userModel.findById(sponsorId);
  } catch (error) {
    throw new BadRequestException('ID de usuario inválido');
  }
  
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // 2. Verificar que el usuario tiene un sponsor asociado
  if (!user.sponsorId) {
    throw new NotFoundException('El usuario no tiene un sponsor asociado');
  }

  // 3. Buscar el sponsor usando el sponsorId del usuario
  let sponsor;
  try {
    sponsor = await this.sponsorModel.findById(user.sponsorId);
  } catch (error) {
    throw new NotFoundException('ID de sponsor inválido en el usuario');
  }
  
  if (!sponsor) {
    throw new NotFoundException('Sponsor asociado no encontrado');
  }

  const actualSponsorId = sponsor._id.toString();

  // Validar que se puede pujar (reutilizar método existente)
  await this.validateBidding(auction, gameId, actualSponsorId, clueId, amount);

  // ✨ NUEVA VALIDACIÓN: Verificar que el sponsor tiene una puja existente en ESA pista específica
  let existingBid;
  try {
    existingBid = await this.bidModel.findOne({
      auctionId: auction._id,
      sponsorId: new Types.ObjectId(actualSponsorId),
      clueId: new Types.ObjectId(clueId) // DEBE ser la misma pista
    });
  } catch (error) {
    throw new BadRequestException('ID de sponsor o pista inválido');
  }

  if (!existingBid) {
    throw new NotFoundException('No tienes una puja activa en esta pista para actualizar. Usa placeBid para crear una nueva puja.');
  }

  console.log('Puja existente encontrada:', {
    id: existingBid._id.toString(),
    currentAmount: existingBid.amount,
    newAmount: amount
  });

  // ✨ NUEVA VALIDACIÓN: El nuevo monto debe ser mayor al actual del sponsor
  if (amount <= existingBid.amount) {
    throw new BadRequestException(
      `El nuevo monto (${amount}) debe ser mayor a tu puja actual (${existingBid.amount})`
    );
  }

  // Encontrar la pista en la subasta
  const biddableClueIndex = auction.biddableClues.findIndex(
    bc => bc.clueId.toString() === clueId
  );

  if (biddableClueIndex === -1) {
    throw new NotFoundException('Pista no encontrada en la subasta');
  }

  const biddableClue = auction.biddableClues[biddableClueIndex];

  // Validar el monto mínimo de la subasta (igual que placeBid)
  const minimumBid = biddableClue.currentBid + auction.incrementValue;
  if (amount < minimumBid) {
    throw new BadRequestException(
      `El monto mínimo de puja es ${minimumBid}`
    );
  }

  // ✨ VALIDACIÓN ADICIONAL: Si el sponsor no es el ganador actual, debe superar la puja más alta
  const isCurrentWinner = biddableClue.currentBidderId?.toString() === actualSponsorId;
  if (!isCurrentWinner && amount <= biddableClue.currentBid) {
    throw new BadRequestException(
      `Debes superar la puja más alta actual de ${biddableClue.currentBid}`
    );
  }

  // Actualizar la puja en la subasta (mismo código que placeBid)
  auction.biddableClues[biddableClueIndex].currentBid = amount;
  auction.biddableClues[biddableClueIndex].currentBidderId = new Types.ObjectId(actualSponsorId);

  // Marcar el array como modificado para que Mongoose lo detecte
  auction.markModified('biddableClues');

  // Guardar la subasta actualizada
  await auction.save();

  // ✨ MODIFICADO: Actualizar el registro de puja existente (NO upsert)
  try {
    await this.bidModel.findByIdAndUpdate(
      existingBid._id,
      {
        amount,
        timestamp: new Date() // Actualizar timestamp
      },
      { new: true }
    );

    console.log('Puja actualizada exitosamente');
  } catch (error) {
    console.error('Error al actualizar la puja:', error);
    throw new BadRequestException('Error al actualizar la puja');
  }

  // Retornar la subasta actualizada (mismo código que placeBid)
  const game = await this.gameModel.findById(gameId);
  const clues = await this.clueModel.find({
    _id: { $in: auction.biddableClues.map(bc => bc.clueId) }
  });

  return this.mapToAuctionResponse(auction, game, clues);
}

// ✨ MÉTODO HELPER ADICIONAL: Validar específicamente las actualizaciones de puja
private async validateBidUpdate(
  auction: AuctionDocument,
  sponsorId: string,
  clueId: string,
  newAmount: number
): Promise<{ existingBid: BidDocument; minimumRequired: number }> {
  // Buscar puja existente
  const existingBid = await this.bidModel.findOne({
    auctionId: auction._id,
    sponsorId: new Types.ObjectId(sponsorId),
    clueId: new Types.ObjectId(clueId)
  });

  if (!existingBid) {
    throw new NotFoundException('No tienes una puja activa en esta pista para actualizar');
  }

  // Calcular mínimo requerido
  const biddableClue = auction.biddableClues.find(
    bc => bc.clueId.toString() === clueId
  );

  if (!biddableClue) {
    throw new NotFoundException('Pista no encontrada en la subasta');
  }

  const minimumRequired = Math.max(
    existingBid.amount + 1, // Debe ser mayor a la puja actual del sponsor
    biddableClue.currentBid + auction.incrementValue // Debe cumplir el incremento mínimo
  );

  if (newAmount < minimumRequired) {
    throw new BadRequestException(
      `El monto mínimo requerido es ${minimumRequired}`
    );
  }

  return { existingBid, minimumRequired };
}
async getAuctionResults(
  gameId: string, 
  requireClosed: boolean = false
): Promise<AuctionResultsResponseDto> {
  // ✅ MEJORA 1: Validar que gameId sea un ObjectId válido
  if (!Types.ObjectId.isValid(gameId)) {
    throw new NotFoundException(`Invalid gameId format: ${gameId}`);
  }

  // ✅ MEJORA 2: Buscar la subasta por gameId con logging
  console.log(`📊 Fetching auction results for game: ${gameId}`);
  
  const auction = await this.auctionModel.findOne({ 
    gameId: new Types.ObjectId(gameId) 
  }).lean();

  if (!auction) {
    throw new NotFoundException(`Auction not found for game: ${gameId}`);
  }

  // ✅ MEJORA 3: Validar que la subasta esté cerrada (si se requiere)
  if (requireClosed) {
    console.log(`🔒 Validating auction status: ${auction.status}`);
    
    if (auction.status !== 'finished') {
      throw new BadRequestException(
        `Auction for game ${gameId} is not closed yet. Current status: ${auction.status}`
      );
    }

    // Validar también por fecha
    const now = new Date();
    const closingDate = new Date(auction.closingDate);
    
    if (now < closingDate) {
      throw new BadRequestException(
        `Auction closing date has not passed yet. Closes on: ${closingDate.toISOString()}`
      );
    }
    
    console.log(`✅ Auction is properly closed`);
  }

  // Usar agregación para obtener toda la información necesaria
  const pipeline = [
    // Stage 1: Buscar la subasta
    {
      $match: { 
        gameId: new Types.ObjectId(gameId) 
      }
    },
    
    // Stage 2: Descomponer el array de biddableClues
    {
      $unwind: {
        path: '$biddableClues',
        preserveNullAndEmptyArrays: false
      }
    },
    
    // Stage 3: Lookup para obtener información de las pistas
    {
      $lookup: {
        from: 'clues',
        localField: 'biddableClues.clueId',
        foreignField: '_id',
        as: 'clueInfo'
      }
    },
    
    // Stage 4: Descomponer el array de clueInfo
    {
      $unwind: '$clueInfo'
    },
    
    // Stage 5: Lookup para obtener información del sponsor (solo si hay ganador)
    {
      $lookup: {
        from: 'sponsors',
        localField: 'biddableClues.currentBidderId',
        foreignField: '_id',
        as: 'sponsorInfo'
      }
    },
    
    // ✅ MEJORA 4: Stage 6 - Proyectar la estructura final con campos adicionales
    {
      $project: {
        // ✅ Información de la subasta (con startingAmountCollaborative)
        auctionInfo: {
          gameId: { $toString: '$gameId' },
          status: '$status',
          closingDate: '$closingDate',
          startingAmount: '$startingAmount',
          startingAmountCollaborative: '$startingAmountCollaborative',  // ✅ NUEVO
          incrementValue: '$incrementValue'
        },
        
        // ✅ Información de la pista (con isCollaborative y requiredPlayers)
        clue: {
          id: { $toString: '$clueInfo._id' },
          title: '$clueInfo.title',
          description: '$clueInfo.description',
          type: '$clueInfo.type',
          isCollaborative: { $ifNull: ['$clueInfo.isCollaborative', false] },  // ✅ NUEVO
          requiredPlayers: { $ifNull: ['$clueInfo.requiredPlayers', 1] }        // ✅ NUEVO
        },
        
        // Información de la puja
     bidding: {
  isWon: {
    $cond: {
      if: { 
        $and: [
          { $ne: ['$biddableClues.currentBidderId', null] },
          { $ne: ['$biddableClues.currentBidderId', undefined] }
        ]
      },
      then: true,
      else: false
    }
  },
  currentBid: '$biddableClues.currentBid',
  currentBidder: {
    $cond: {
      if: { 
        $and: [
          { $ne: ['$biddableClues.currentBidderId', null] },
          { $gt: [{ $size: '$sponsorInfo' }, 0] }
        ]
      },
      then: {
        sponsorId: { $toString: { $arrayElemAt: ['$sponsorInfo._id', 0] } },
        nombreEmpresa: { $arrayElemAt: ['$sponsorInfo.nombreEmpresa', 0] },
        representanteLegal: { $arrayElemAt: ['$sponsorInfo.representanteLegal', 0] },
        celular: { $arrayElemAt: ['$sponsorInfo.celular', 0] },
        correo: { $arrayElemAt: ['$sponsorInfo.correo', 0] },
        nit: { $arrayElemAt: ['$sponsorInfo.nit', 0] }
      },
      else: null
    }
  }
}
      }
    },
    
    // Stage 7: Agrupar para reconstruir la estructura
    {
      $group: {
        _id: '$auctionInfo.gameId',
        auctionInfo: { $first: '$auctionInfo' },
        results: {
          $push: {
            clue: '$clue',
            bidding: '$bidding'
          }
        }
      }
    }
  ];

  console.log(`🔄 Executing aggregation pipeline...`);
  const aggregationResult = await this.auctionModel.aggregate(pipeline);

  if (!aggregationResult.length) {
    throw new NotFoundException(`No auction data found for game: ${gameId}`);
  }

  const result = aggregationResult[0];

  // ✅ MEJORA 5: Calcular estadísticas adicionales con logging
  const totalClues = result.results.length;
  const wonClues = result.results.filter(r => r.bidding.isWon).length;
  const individualClues = result.results.filter(r => !r.clue.isCollaborative).length;
  const collaborativeClues = result.results.filter(r => r.clue.isCollaborative).length;

  console.log(`📊 Results summary:
    - Total clues: ${totalClues}
    - Won clues: ${wonClues}
    - Individual clues: ${individualClues}
    - Collaborative clues: ${collaborativeClues}
  `);

  // ✅ MEJORA 6: Construir la respuesta final con información completa
  const response: AuctionResultsResponseDto = {
    auction: {
      ...result.auctionInfo,
      totalClues,
      wonClues
    },
    results: result.results
  };

  console.log(`✅ Successfully fetched auction results for game: ${gameId}`);
  return response;
}

  // ✅ NUEVO MÉTODO: Obtener detalles de TODAS las pistas
// ============================================================================
// MÉTODO COMPLETO: getAllCluesDetails con filtrado de pistas excluidas
// UBICACIÓN: pujas.service.ts - Reemplazar método completo (líneas ~1586-1699)
// ============================================================================

// ============================================================================
// MÉTODO CORREGIDO: getAllCluesDetails
// UBICACIÓN: pujas.service.ts - Líneas 1757-1885
// CAMBIO: Retornar solo pistas que están en biddableClues (subasta)
// ============================================================================

private async getAllCluesDetails(
  gameId: string,
  auction: AuctionDocument | null,
  sponsorId: string
): Promise<CollaborativeClueDetailDto[]> {
  try {
    // ============================================================================
    // ✅ CAMBIO PRINCIPAL: Obtener solo pistas que están en la subasta
    // ============================================================================
    
    let allClues;
    
    // Si hay subasta con pistas en subasta, obtener solo esas pistas
    if (auction && auction.biddableClues && auction.biddableClues.length > 0) {
      console.log(`🎯 Juego con subasta - Filtrando pistas de biddableClues`);
      
      // Filtrar pistas disponibles para este sponsor
      const availableBiddableClues = await this.filterAvailableCluesForSponsor(
        gameId,
        sponsorId,
        auction.biddableClues
      );
      
      console.log(`📋 Pistas disponibles en subasta: ${availableBiddableClues.length}`);
      
      if (availableBiddableClues.length === 0) {
        console.log(`⚠️ No hay pistas disponibles en subasta para este sponsor`);
        return [];
      }
      
      // Obtener IDs de las pistas que están en la subasta (filtradas por sponsor)
      const biddableClueIds = availableBiddableClues.map(bc => bc.clueId);
      
      // Obtener SOLO las pistas que están en biddableClues
      allClues = await this.clueModel.find({
        _id: { $in: biddableClueIds }
      })
      .select('_id title requiredPlayers isCollaborative type')
      .sort({ order: 1 })
      .exec();
      
      console.log(`✅ Obtenidas ${allClues.length} pistas de la subasta`);
      
    } else {
      // Si no hay subasta, obtener todas las pistas del juego
      console.log(`📋 Juego sin subasta - Obteniendo todas las pistas`);
      
      allClues = await this.clueModel.find({
        gameId: new Types.ObjectId(gameId)
      })
      .select('_id title requiredPlayers isCollaborative type')
      .sort({ order: 1 })
      .exec();
      
      console.log(`✅ Obtenidas ${allClues.length} pistas del juego`);
    }

    if (allClues.length === 0) {
      return [];
    }

    // Si no hay subasta, todas las pistas tienen valores por defecto
    if (!auction) {
      return allClues.map(clue => ({
        _id: clue._id.toString(),
        title: clue.title,
        type: clue.type || 'individual',
        isCollaborative: clue.isCollaborative || false,
        requiredPlayers: clue.requiredPlayers || (clue.isCollaborative ? 2 : 1),
        bidInfo: {
          hasBid: false,
          currentBid: 0,
          minimumNextBid: 0,
          isUserBidding: false
        }
      }));
    }

    // ============================================================================
    // Procesar información de pujas para las pistas en subasta
    // ============================================================================
    
    // Filtrar pistas disponibles para este sponsor
    const availableBiddableClues = await this.filterAvailableCluesForSponsor(
      gameId,
      sponsorId,
      auction.biddableClues
    );

    // Crear map de pistas DISPONIBLES para búsqueda rápida
    const biddableCluesMap = new Map();
    availableBiddableClues.forEach(bc => {
      biddableCluesMap.set(bc.clueId.toString(), bc);
    });

    // Obtener nombres de sponsors que están pujando
    const sponsorIds = availableBiddableClues
      .filter(bc => bc.currentBidderId)
      .map(bc => bc.currentBidderId);

    const sponsors = await this.sponsorModel.find({
      _id: { $in: sponsorIds }
    }).select('_id nombreEmpresa').exec();

    const sponsorsMap = new Map();
    sponsors.forEach(sponsor => {
      sponsorsMap.set(sponsor._id.toString(), sponsor.nombreEmpresa);
    });

    // Combinar información de pistas con información de pujas
    const result: CollaborativeClueDetailDto[] = allClues.map(clue => {
      const clueIdStr = clue._id.toString();
      const biddableClue = biddableCluesMap.get(clueIdStr);
      const isCollaborative = clue.isCollaborative || false;
      let bidInfo: ClueBidInfoDto;

      if (!biddableClue) {
        // Pista no está en la subasta o excluida para este sponsor
        bidInfo = {
          hasBid: false,
          currentBid: 0,
          minimumNextBid: 0,
          isUserBidding: false
        };
      } else {
        // Pista disponible - mostrar información de pujas
        const currentBidderId = biddableClue.currentBidderId?.toString();
        const currentBidderName = currentBidderId ? sponsorsMap.get(currentBidderId) : undefined;
        const isUserBidding = currentBidderId === sponsorId;
        const hasBid = !!currentBidderId;

        bidInfo = {
          hasBid,
          currentBid: biddableClue.currentBid,
          currentBidderId,
          currentBidderName,
          minimumNextBid: hasBid 
            ? biddableClue.currentBid + auction.incrementValue
            : biddableClue.currentBid,
          isUserBidding
        };
      }

      return {
        _id: clueIdStr,
        title: clue.title,
        type: clue.type || 'individual',
        isCollaborative: clue.isCollaborative || false,
        requiredPlayers: clue.requiredPlayers || (clue.isCollaborative ? 2 : 1),
        bidInfo
      };
    });

    console.log(`📊 Retornando ${result.length} pistas con información de pujas`);
    return result;

  } catch (error) {
    console.error('Error obteniendo detalles de pistas:', error);
    return [];
  }
}

/*
private async getAllCluesDetails(
  gameId: string,
  auction: AuctionDocument | null,
  sponsorId: string
): Promise<CollaborativeClueDetailDto[]> {
  try {
    // 1. Obtener TODAS las pistas del juego
    const allClues = await this.clueModel.find({
      gameId: new Types.ObjectId(gameId)
    })
    .select('_id title requiredPlayers isCollaborative type')
    .sort({ order: 1 })
    .exec();

    if (allClues.length === 0) {
      return [];
    }

    // 2. Si no hay subasta, todas las pistas tienen valores por defecto
    if (!auction) {
      return allClues.map(clue => ({
        _id: clue._id.toString(),
        title: clue.title,
        type: clue.type || 'individual',
        isCollaborative: clue.isCollaborative || false,
        requiredPlayers: clue.requiredPlayers || (clue.isCollaborative ? 2 : 1),
        bidInfo: {
          hasBid: false,
          currentBid: 0,
          minimumNextBid: 0,
          isUserBidding: false
        }
      }));
    }

    // ============================================================================
    // ✅ NUEVO: Filtrar pistas disponibles para este sponsor
    // ============================================================================
    
    const availableBiddableClues = await this.filterAvailableCluesForSponsor(
      gameId,
      sponsorId,
      auction.biddableClues
    );

    // 3. Crear map de pistas DISPONIBLES para búsqueda rápida
    const biddableCluesMap = new Map();
    availableBiddableClues.forEach(bc => {  // ✅ MODIFICADO: usar pistas filtradas
      biddableCluesMap.set(bc.clueId.toString(), bc);
    });

    // 4. Obtener nombres de sponsors que están pujando
    const sponsorIds = availableBiddableClues  // ✅ MODIFICADO: usar pistas filtradas
      .filter(bc => bc.currentBidderId)
      .map(bc => bc.currentBidderId);

    const sponsors = await this.sponsorModel.find({
      _id: { $in: sponsorIds }
    }).select('_id nombreEmpresa').exec();

    const sponsorsMap = new Map();
    sponsors.forEach(sponsor => {
      sponsorsMap.set(sponsor._id.toString(), sponsor.nombreEmpresa);
    });

    // 5. Combinar información de pistas con información de pujas
    const result: CollaborativeClueDetailDto[] = allClues.map(clue => {
      const clueIdStr = clue._id.toString();
      const biddableClue = biddableCluesMap.get(clueIdStr);
      const isCollaborative = clue.isCollaborative || false;
      let bidInfo: ClueBidInfoDto;

      // ============================================================================
      // ✅ MODIFICADO: Si la pista no está disponible, no mostrar info de subasta
      // ============================================================================
      
      if (!biddableClue) {
        // Caso 1: Pista excluida (asignada a otro sponsor)
        // Caso 2: Pista no está en subasta
        // En ambos casos, no mostrar información de pujas
        const initialAmount = isCollaborative
          ? (auction.startingAmountCollaborative || auction.startingAmount)
          : auction.startingAmount;
        
        bidInfo = {
          hasBid: false,
          currentBid: 0,
          minimumNextBid: 0,
          isUserBidding: false
        };
      } else {
        // Pista disponible - mostrar información de pujas
        const currentBidderId = biddableClue.currentBidderId?.toString();
        const currentBidderName = currentBidderId ? sponsorsMap.get(currentBidderId) : undefined;
        const isUserBidding = currentBidderId === sponsorId;

        // ✅ Determinar si hay puja
        const hasBid = !!currentBidderId;

        bidInfo = {
          hasBid,
          currentBid: biddableClue.currentBid,
          currentBidderId,
          currentBidderName,
          // ✅ CORRECCIÓN: Solo suma incremento si ya hay puja
          minimumNextBid: hasBid 
            ? biddableClue.currentBid + auction.incrementValue  // Con puja: suma incremento
            : biddableClue.currentBid,  // Sin puja: solo startingAmount
          isUserBidding
        };
      }

      return {
        _id: clueIdStr,
        title: clue.title,
        type: clue.type || 'individual',
        isCollaborative: clue.isCollaborative || false,
        requiredPlayers: clue.requiredPlayers || (clue.isCollaborative ? 2 : 1),
        bidInfo
      };
    });

    return result;

  } catch (error) {
    console.error('Error obteniendo detalles de todas las pistas:', error);
    return [];
  }
}*/

// ============================================================================
// HELPER REQUERIDO: filterAvailableCluesForSponsor
// ============================================================================

/**
 * Filtra pistas de una subasta para excluir las asignadas a otros sponsors
 * 
 * @param gameId - ID del juego
 * @param sponsorId - ID del sponsor actual
 * @param biddableClues - Array de BiddableClue de la subasta
 * @returns Array filtrado de BiddableClue disponibles para el sponsor
 */
private async filterAvailableCluesForSponsor(
  gameId: string | Types.ObjectId,
  sponsorId: string,
  biddableClues: BiddableClue[]
): Promise<BiddableClue[]> {
  
  // 1. Obtener todas las asignaciones específicas de pistas en este juego
  const clueAssignments = await this.gameSponsorModel.find({
    gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId,
    clueId: { $exists: true, $ne: null }  // Solo asignaciones de pistas específicas
  }).select('clueId sponsorId');

  console.log(`🔍 Encontradas ${clueAssignments.length} asignaciones de pistas específicas en el juego`);

  // 2. Crear map: clueId -> sponsorId
  const clueToSponsorMap = new Map<string, string>();
  clueAssignments.forEach(assignment => {
    if (assignment.clueId) {
      clueToSponsorMap.set(
        assignment.clueId.toString(), 
        assignment.sponsorId.toString()
      );
    }
  });

  // 3. Filtrar biddableClues
  const filteredClues = biddableClues.filter(bc => {
    const clueIdStr = bc.clueId.toString();
    const assignedToSponsor = clueToSponsorMap.get(clueIdStr);
    
    if (!assignedToSponsor) {
      // Pista NO está asignada a nadie específicamente -> DISPONIBLE
      return true;
    }
    
    if (assignedToSponsor === sponsorId) {
      // Pista está asignada al sponsor actual -> DISPONIBLE
      return true;
    }
    
    // Pista está asignada a OTRO sponsor -> NO DISPONIBLE
    console.log(`  🚫 Pista ${clueIdStr} excluida (asignada a sponsor ${assignedToSponsor})`);
    return false;
  });

  console.log(`✅ Pistas filtradas: ${filteredClues.length} de ${biddableClues.length} disponibles para sponsor ${sponsorId}`);
  
  return filteredClues;
}



// ============================================================================
// MÉTODO COMPLETO: getAvailableGames con filtrado de pistas excluidas
// UBICACIÓN: pujas.service.ts - Reemplazar método completo (líneas ~540-731)
// ============================================================================

async getAvailableGames(userId: string): Promise<AvailableGamesResponseDto> {
  // 1. Buscar el usuario y verificar que existe
  let user;
  try {
    user = await this.userModel.findById(userId);
  } catch (error) {
    throw new BadRequestException('ID de usuario inválido');
  }
  
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  // 2. Verificar que el usuario tiene un sponsor asociado
  if (!user.sponsorId) {
    throw new NotFoundException('El usuario no tiene un sponsor asociado');
  }

  // 3. Buscar el sponsor usando el sponsorId del usuario
  let sponsor;
  try {
    sponsor = await this.sponsorModel.findById(user.sponsorId);
  } catch (error) {
    throw new NotFoundException('ID de sponsor inválido en el usuario');
  }
  
  if (!sponsor) {
    throw new NotFoundException('Sponsor asociado no encontrado');
  }

  const sponsorId = sponsor._id.toString();

  // 4. Buscar todos los juegos en estado waiting
  const waitingGames = await this.gameModel.find({ 
    status: GameStatus.WAITING 
  });

  if (waitingGames.length === 0) {
    return {
      availableGames: [],
      totalAvailable: 0,
      sponsorInfo: {
        id: sponsor._id.toString(),
        name: sponsor.nombreEmpresa
      }
    };
  }

  // 5. Buscar juegos donde el sponsor YA está asociado (excluir estos)
  const associatedGames = await this.gameSponsorModel.find({
    sponsorId: new Types.ObjectId(sponsorId)
  });
  const associatedGameIds = associatedGames.map(ag => ag.gameId.toString());

  // 6. Buscar subastas donde el sponsor tiene pujas activas
  const activeBids = await this.bidModel.find({
    sponsorId: new Types.ObjectId(sponsorId)
  });

  let gamesWithActiveBids: string[] = [];
  if (activeBids.length > 0) {
    const auctionsWithBids = await this.auctionModel.find({
      _id: { $in: activeBids.map(bid => bid.auctionId) }
    });
    gamesWithActiveBids = auctionsWithBids.map(auction => auction.gameId.toString());
  }

  // 7. Filtrar juegos disponibles
  const availableGames = waitingGames.filter(game => {
    const gameIdStr = game._id.toString();
    return !associatedGameIds.includes(gameIdStr) && !gamesWithActiveBids.includes(gameIdStr);
  });

  // 8. Para cada juego disponible, obtener información adicional
  const gameResults: AvailableGameDto[] = [];

  for (const game of availableGames) {
    // Contar TODAS las pistas
    const totalClues = await this.clueModel.countDocuments({
      gameId: game._id
    });

    const collaborativeClues = await this.clueModel.countDocuments({
      gameId: game._id,
      isCollaborative: true
    });

    // Verificar si hay subasta activa
    const auction = await this.auctionModel.findOne({
      gameId: game._id
    });

    // Obtener detalles de pistas (ya incluye filtrado de excluidas)
    const allCluesDetails = await this.getAllCluesDetails(
      game._id.toString(),
      auction,
      user.sponsorId.toString()
    );

    const gameDto: AvailableGameDto = {
      id: game._id.toString(),
      name: game.name,
      description: game.description,
      maxPlayers: game.maxPlayers,
      collaborativeClues,
      totalClues,
      hasActiveAuction: !!auction,
      createdAt: game.createdAt || new Date(),
      collaborativeCluesDetails: allCluesDetails
    };

    // Si hay subasta, agregar información incluyendo biddableClues
    if (auction) {
      // ✅ NUEVO: Filtrar pistas disponibles para este sponsor
      const availableBiddableClues = await this.filterAvailableCluesForSponsor(
        game._id.toString(),
        sponsorId,
        auction.biddableClues
      );

      // Obtener información de todos los clues para obtener títulos
      const allClues = await this.clueModel.find({
        gameId: game._id
      }).select('_id title isCollaborative type');

      // Crear map para búsqueda rápida de títulos y tipos
      const clueIdToInfo = new Map();
      allClues.forEach(clue => {
        clueIdToInfo.set(clue._id.toString(), {
          title: clue.title,
          isCollaborative: clue.isCollaborative,
          type: clue.type
        });
      });

      // Obtener sponsors que están pujando para obtener nombres
      const sponsorIds = availableBiddableClues  // ✅ MODIFICADO: usar pistas filtradas
        .filter(bc => bc.currentBidderId)
        .map(bc => bc.currentBidderId);

      let sponsors = [];
      if (sponsorIds.length > 0) {
        sponsors = await this.sponsorModel.find({
          _id: { $in: sponsorIds }
        }).select('_id nombreEmpresa');
      }

      const sponsorIdToName = new Map();
      sponsors.forEach(sponsor => {
        sponsorIdToName.set(sponsor._id.toString(), sponsor.nombreEmpresa);
      });

      // ✅ MODIFICADO: Construir auctionInfo solo con pistas disponibles
      gameDto.auctionInfo = {
        closingDate: auction.closingDate,
        startingAmount: auction.startingAmount,
        startingAmountCollaborative: auction.startingAmountCollaborative,
        incrementValue: auction.incrementValue,
        biddableClues: availableBiddableClues.map(bc => {  // ✅ usar pistas filtradas
          const clueInfo = clueIdToInfo.get(bc.clueId.toString()) || {
            title: 'Pista desconocida',
            isCollaborative: false,
            type: 'unknown'
          };
          
          return {
            clueId: bc.clueId.toString(),
            clueTitle: clueInfo.title,
            isCollaborative: clueInfo.isCollaborative,
            type: clueInfo.type,
            currentBid: bc.currentBid,
            currentBidderId: bc.currentBidderId?.toString(),
            currentBidderName: bc.currentBidderId ? 
              sponsorIdToName.get(bc.currentBidderId.toString()) : 
              undefined
          };
        })
      };
    }

    gameResults.push(gameDto);
  }

  // 9. Ordenar por fecha de creación (más recientes primero)
  gameResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    availableGames: gameResults,
    totalAvailable: gameResults.length,
    sponsorInfo: {
      id: sponsor._id.toString(),
      name: sponsor.nombreEmpresa
    }
  };
}

// ============================================================================
// NOTAS DE IMPLEMENTACIÓN
// ============================================================================

/**
 * CAMBIOS REALIZADOS:
 * 
 * 1. Línea ~110: Se agregó llamada a filterAvailableCluesForSponsor
 *    - Filtra auction.biddableClues antes de procesarlas
 *    - Solo retorna pistas disponibles para el sponsor actual
 * 
 * 2. Línea ~125: Se modificó para obtener sponsorIds de pistas filtradas
 *    - Usa availableBiddableClues en lugar de auction.biddableClues
 * 
 * 3. Línea ~145: Se modificó construcción de biddableClues
 *    - Mapea availableBiddableClues en lugar de auction.biddableClues
 * 
 * FLUJO:
 * - getAllCluesDetails ya maneja el filtrado internamente
 * - getAvailableGames filtra las biddableClues en auctionInfo
 * - Resultado: sponsor solo ve pistas que puede pujar
 */


}