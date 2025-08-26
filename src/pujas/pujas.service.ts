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

  async createAuction(createAuctionDto: CreateAuctionDto): Promise<AuctionResponseDto> {
    const { gameId, startingAmount, incrementValue, closingDate } = createAuctionDto;

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

    // Obtener pistas colaborativas del juego
    const collaborativeClues = await this.clueModel.find({
      gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId,
      isCollaborative: true
    });

    if (collaborativeClues.length === 0) {
      throw new BadRequestException('No hay pistas colaborativas disponibles para subastar');
    }

    // Crear las pistas que estarán en subasta
    const biddableClues: BiddableClue[] = collaborativeClues.map(clue => ({
      clueId: clue._id as Types.ObjectId,
      currentBid: startingAmount,
      isWon: false
    }));

    // Crear la subasta
    const auction = new this.auctionModel({
      gameId: Types.ObjectId.isValid(gameId) ? new Types.ObjectId(gameId) : gameId,
      startingAmount,
      incrementValue,
      status: AuctionStatus.ACTIVE,
      biddableClues,
      closingDate: new Date(closingDate)
    });

    const savedAuction = await auction.save();
    return this.mapToAuctionResponse(savedAuction, game, collaborativeClues);
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

    sponsor = sponsor._id.toString();



    // Validar que se puede pujar
    await this.validateBidding(auction, gameId, sponsor, clueId, amount);

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

    // Validar el monto mínimo
    const minimumBid = biddableClue.currentBid + auction.incrementValue;
    if (amount < minimumBid) {
      throw new BadRequestException(
        `El monto mínimo de puja es ${minimumBid}`
      );
    }

    // Actualizar la puja en la subasta - forma más segura
    auction.biddableClues[biddableClueIndex].currentBid = amount;
    auction.biddableClues[biddableClueIndex].currentBidderId = new Types.ObjectId(sponsor);

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
          sponsorId: new Types.ObjectId(sponsor),
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
      // Contar pistas colaborativas
      const collaborativeClues = await this.clueModel.countDocuments({
        gameId: game._id,
        isCollaborative: true
      });

      // Verificar si hay subasta activa
      const auction = await this.auctionModel.findOne({
        gameId: game._id
      });

      // ✅ NUEVO: Obtener detalles de pistas colaborativas
      const collaborativeCluesDetails = await this.getCollaborativeCluesDetails(
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
        hasActiveAuction: !!auction,
        createdAt: game.createdAt || new Date(),
        collaborativeCluesDetails // ✅ NUEVO CAMPO
      };

      // Si hay subasta, agregar información
      if (auction) {
        gameDto.auctionInfo = {
          closingDate: auction.closingDate,
          startingAmount: auction.startingAmount,
          incrementValue: auction.incrementValue
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

    // Verificar que la pista existe y es colaborativa - con manejo de errores
    let clue;
    try {
      clue = await this.clueModel.findById(clueId);
    } catch (error) {
      throw new NotFoundException('ID de pista inválido');
    }

    if (!clue) {
      throw new NotFoundException('Pista no encontrada');
    }

    if (!clue.isCollaborative) {
      throw new BadRequestException('Solo se puede pujar por pistas colaborativas');
    }
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
}