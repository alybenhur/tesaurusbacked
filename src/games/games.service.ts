import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Game, GameDocument, GameStatus } from './schemas/game.schema';
import { Clue, ClueDocument, ClueStatus, ClueSetupStatus } from '../clues/schemas/clue.schema';
import { CreateGameDto } from './dto/create-game.dto';
//import { UpdateGameDto } from './dto/update-game.dto';
import { CreateClueDto } from '../clues/dto/create-clue.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { PlayerProgress, PlayerProgressDocument } from './schemas/player-progress.schema';
import { CollaborativeAttempt, CollaborativeAttemptDocument, CollaborativeAttemptStatus } from './schemas/collaborative-attempt.schema';
import { AchievementType, PlayerAchievement, PlayerAchievementDocument } from './schemas/player-achievement.schema';
import { Auction, AuctionDocument, AuctionStatus } from '../pujas/schemas/auction.schema';
import { Bid, BidDocument } from '../pujas/schemas/bid.schema';
import { Sponsor, SponsorDocument } from '../sponsor/schemas/sponsor.schema';
import { GameSponsorAssociation, GameSponsorAssociationDocument } from '../gamesponsor/schemas/gamesponsor.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Injectable()
export class GamesService {
  constructor(
    @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    @InjectModel(Clue.name) private clueModel: Model<ClueDocument>,
    @InjectModel(Auction.name) private auctionModel: Model<AuctionDocument>,
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>, // NUEVO
    @InjectModel(Sponsor.name) private sponsorModel: Model<SponsorDocument>,
    @InjectModel(GameSponsorAssociation.name) private gameSponsorModel: Model<GameSponsorAssociationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PlayerProgress.name) private playerProgressModel: Model<PlayerProgressDocument>,
    @InjectModel(CollaborativeAttempt.name) private collaborativeAttemptModel: Model<CollaborativeAttemptDocument>,
    @InjectModel(PlayerAchievement.name) private playerAchievementModel: Model<PlayerAchievementDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  async create(createGameDto: CreateGameDto, files?: Express.Multer.File[]): Promise<Game> {
    try {
      // 1. Crear el juego primero
      const gameData = {
        name: createGameDto.name,
        description: createGameDto.description,
        adminId: createGameDto.adminId,
        maxPlayers: createGameDto.maxPlayers,
        revealDelayMs: createGameDto.revealDelayMs,
        status: 'waiting',
        playerIds: [createGameDto.adminId], // El admin se une automáticamente
        clues: [], // Se llenará después de crear las pistas
        gameArea: {
          center: { latitude: 0, longitude: 0 },
          bounds: {
            northEast: { latitude: 0, longitude: 0 },
            southWest: { latitude: 0, longitude: 0 }
          }
        },
        metadata: {
          totalClues: createGameDto.clues?.length || 0,
          completedClues: 0,
          lastActivity: new Date()
        }
      };

      const createdGame = new this.gameModel(gameData);
      const savedGame = await createdGame.save();

      // 2. Crear las pistas si existen
      if (createGameDto.clues && createGameDto.clues.length > 0) {
        const clueIds = await this.createCluesForGame(savedGame._id.toString(), createGameDto.clues, files);

        // 3. Actualizar el juego con los IDs de las pistas
        savedGame.clues = clueIds;
        savedGame.metadata.totalClues = clueIds.length;

        // 4. Calcular el área del juego basado en las ubicaciones de las pistas
        const gameArea = await this.calculateGameArea(clueIds);
        if (gameArea) {
          savedGame.gameArea = gameArea;
        }

        await savedGame.save();
      }

      return savedGame;
    } catch (error) {
      throw new BadRequestException(`Error creating game: ${error.message}`);
    }
  }

  async findActiveGames(): Promise<Game[]> {
    return this.gameModel.find({ status: GameStatus.ACTIVE }).populate('clues').exec();
  }


  private async createCluesForGame(
    gameId: string,
    cluesDto: CreateClueDto[],
    files?: Express.Multer.File[]
  ): Promise<Types.ObjectId[]> {
    const cluePromises = cluesDto.map(async (clueDto, index) => {
      let imageUrl = clueDto.imageUrl;

      // Si hay archivos, buscar uno que coincida con el idPista
      if (files && files.length > 0) {
        const file = files.find(f => f.fieldname === clueDto.idPista);
        if (file) {
          console.log(`Subiendo imagen para la pista: ${clueDto.idPista}`);
          const uploadResult = await this.cloudinaryService.uploadFile(file);
          imageUrl = uploadResult.secure_url;
        }
      }

      const clueData = {
        ...clueDto,
        gameId: new Types.ObjectId(gameId), // Convertir a ObjectId
        order: clueDto.order || index,
        status: 'hidden',
        idPista: clueDto.idPista,
        range: clueDto.range,
        imageUrl, // Usar la URL de Cloudinary si se subió un archivo
        ...(clueDto.latitude && clueDto.longitude && {
          location: {
            latitude: clueDto.latitude,
            longitude: clueDto.longitude
          }
        })

      };

      const clue = new this.clueModel(clueData);
      const savedClue = await clue.save();
      return savedClue._id as Types.ObjectId; // Conversión explícita de tipo
    });

    return Promise.all(cluePromises);
  }

  async removeClueFromGame(gameId: string, clueId: string): Promise<Game> {
    try {
      // 1. Verificar que el juego existe
      const game = await this.gameModel.findById(gameId).populate('clues').exec();
      if (!game) {
        throw new NotFoundException(`Game with ID ${gameId} not found`);
      }

      // 2. Verificar que el juego no esté activo (opcional - puedes permitir eliminar pistas en juegos activos)
      if (game.status === GameStatus.ACTIVE) {
        throw new BadRequestException('Cannot remove clues from an active game');
      }

      // 3. Verificar que la pista existe y pertenece al juego
      const clue = await this.clueModel.findById(clueId).exec();
      if (!clue) {
        throw new NotFoundException(`Clue with ID ${clueId} not found`);
      }

      if (clue.gameId.toString() !== gameId) {
        throw new BadRequestException('Clue does not belong to this game');
      }

      // 4. Eliminar la pista de la base de datos
      await this.clueModel.deleteOne({ _id: clueId }).exec();

      // 5. Remover la referencia de la pista del juego
      game.clues = game.clues.filter(clueObjectId =>
        clueObjectId.toString() !== clueId
      );

      // 6. Actualizar metadatos del juego
      game.metadata.totalClues = game.clues.length;
      game.metadata.lastActivity = new Date();

      // 7. Recalcular el área del juego si es necesario
      if (game.clues.length > 0) {
        const gameArea = await this.calculateGameArea(game.clues as Types.ObjectId[]);
        if (gameArea) {
          game.gameArea = gameArea;
        }
      } else {
        // Si no quedan pistas, resetear el área del juego
        game.gameArea = {
          center: { latitude: 0, longitude: 0 },
          bounds: {
            northEast: { latitude: 0, longitude: 0 },
            southWest: { latitude: 0, longitude: 0 }
          }
        };
      }

      // 8. Guardar los cambios
      await game.save();

      // 9. Retornar el juego actualizado con las pistas pobladas
      return this.gameModel.findById(gameId).populate('clues').exec();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error removing clue from game: ${error.message}`);
    }
  }


  private async calculateGameArea(clueIds: Types.ObjectId[]) {
    const clues = await this.clueModel.find({
      _id: { $in: clueIds },
      location: { $exists: true }
    }).exec();

    if (clues.length === 0) return null;

    const locations = clues
      .filter(clue => clue.location)
      .map(clue => clue.location);

    if (locations.length === 0) return null;

    // Calcular bounds
    const latitudes = locations.map(loc => loc.latitude);
    const longitudes = locations.map(loc => loc.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    // Calcular centro
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Agregar padding del 10%
    const latPadding = (maxLat - minLat) * 0.1;
    const lngPadding = (maxLng - minLng) * 0.1;

    return {
      center: {
        latitude: centerLat,
        longitude: centerLng
      },
      bounds: {
        northEast: {
          latitude: maxLat + latPadding,
          longitude: maxLng + lngPadding
        },
        southWest: {
          latitude: minLat - latPadding,
          longitude: minLng - lngPadding
        }
      }
    };
  }

  /* async findAll(): Promise<Game[]> {
    return this.gameModel.find().populate('clues').exec();
  }*/

  async findAll(): Promise<Game[]> {
    // 1-3. Obtener juegos, subastas y bids (igual que antes)
    const games = await this.gameModel.find().populate('clues').exec();
    const gameIds = games.map(game => game._id);
    const auctions = await this.auctionModel.find({ gameId: { $in: gameIds } }).exec();
    const auctionIds = auctions.map(auction => auction._id);
    const bids = await this.bidModel.find({ auctionId: { $in: auctionIds } }).exec();

    // 4. Obtener sponsors con los campos correctos
    const sponsorIds = [...new Set(bids.map(bid => bid.sponsorId.toString()))];
    const sponsors = await this.sponsorModel.find({
      _id: { $in: sponsorIds }
    }).select('nombreEmpresa correo nit representanteLegal').exec(); // ← CAMPOS CORRECTOS

    // 5. Crear mapa de sponsors
    const sponsorMap = new Map();
    sponsors.forEach(sponsor => {
      sponsorMap.set(sponsor._id.toString(), sponsor);
    });

    // 6-7. Organizar datos (igual que antes)
    const auctionMap = new Map();
    const bidsByAuction = new Map();

    auctions.forEach(auction => {
      auctionMap.set(auction.gameId.toString(), auction);
    });

    bids.forEach(bid => {
      const auctionId = bid.auctionId.toString();
      if (!bidsByAuction.has(auctionId)) {
        bidsByAuction.set(auctionId, []);
      }
      bidsByAuction.get(auctionId).push(bid);
    });

    // 8. Enriquecer con campos correctos del sponsor
    return games.map(game => {
      const gameObj = game.toObject();
      const auction = auctionMap.get(game._id.toString());

      let auctionInfo = null;
      if (auction) {
        const auctionBids = bidsByAuction.get(auction._id.toString()) || [];

        auctionInfo = {
          ...auction.toObject(),
          totalBids: auctionBids.length,
          bids: auctionBids.map(bid => {
            const sponsor = sponsorMap.get(bid.sponsorId.toString());
            return {
              _id: bid._id,
              auctionId: bid.auctionId,
              clueId: bid.clueId,
              sponsorId: bid.sponsorId,
              // ← USAR CAMPOS CORRECTOS DEL SPONSOR
              sponsorName: sponsor?.nombreEmpresa || 'Sponsor no encontrado',
              sponsorEmail: sponsor?.correo || null,
              sponsorNit: sponsor?.nit || null,
              sponsorRepresentante: sponsor?.representanteLegal || null,
              amount: bid.amount,
              timestamp: bid.timestamp
            };
          })
        };
      }

      return {
        ...gameObj,
        auction: auctionInfo
      };
    });
  }

  async findOne(id: string): Promise<Game> {
    const game = await this.gameModel.findById(id).populate('clues').exec();
    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }
    return game;
  }

  async update(id: string, updateGameDto: UpdateGameDto): Promise<Game> {
    const updatedGame = await this.gameModel
      .findByIdAndUpdate(id, updateGameDto, { new: true })
      .populate('clues')
      .exec();

    if (!updatedGame) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    return updatedGame;
  }

  async remove(id: string): Promise<void> {
    // Primero eliminar todas las pistas del juego
    await this.clueModel.deleteMany({ gameId: id }).exec();

    // Luego eliminar el juego
    const result = await this.gameModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }
  }

  async joinGame(gameId: string, playerId: string): Promise<{ game: Game; firstClue: Clue | null }> {
    // Validar que gameId sea un ObjectId válido
    if (!Types.ObjectId.isValid(gameId)) {
      throw new BadRequestException(`ID de juego inválido: ${gameId}`);
    }

    const game = await this.gameModel.findById(gameId).populate({
      path: 'clues',
      model: 'Clue',
    }).exec();

    if (!game) {
      throw new NotFoundException(`Juego con ID ${gameId} no encontrado`);
    }

    if (game.playerIds.includes(playerId)) {
      throw new BadRequestException('El jugador ya está inscrito en este juego');
    }

    if (game.playerIds.length >= game.maxPlayers) {
      throw new BadRequestException('El juego está lleno');
    }

    // Agregar el jugador al juego
    game.playerIds.push(playerId);
    game.metadata.lastActivity = new Date();

    // Guardar el juego
    await game.save();

    // Buscar o crear el progreso del jugador
    let playerProgress = await this.playerProgressModel.findOne({ gameId, playerId }).exec();
    if (!playerProgress) {
      playerProgress = new this.playerProgressModel({
        gameId: new Types.ObjectId(gameId),
        playerId,
        clues: [],
        totalPoints: 0,
        lastActivity: new Date(),
      });
    }

    // Depuración: Verificar las pistas asociadas al juego
    console.log(`Contenido de game.clues: ${JSON.stringify(game.clues, null, 2)}`);
    console.log(`Número de pistas en game.clues: ${game.clues.length}`);
    const clueIds = game.clues.map((clue: any) => clue._id?.toString() || clue.toString());
    console.log(`IDs de pistas en game.clues: ${JSON.stringify(clueIds, null, 2)}`);

    // Obtener la primera pista (ordenada por `order`)
    const firstClue = await this.clueModel.findOne({
      gameId: new Types.ObjectId(gameId),
      order: 0
    }).exec();

    // Depuración: Registrar si no se encontró la primera pista
    if (!firstClue) {
      console.warn(`No se encontró ninguna pista con order: 0 para el juego ${gameId}`);
      console.log(`Consulta ejecutada: gameId: ${new Types.ObjectId(gameId)}, order: 0`);
      // Consulta adicional para verificar todas las pistas del juego
      const allClues = await this.clueModel.find({ gameId: new Types.ObjectId(gameId) }).exec();
      console.log(`Todas las pistas del juego ${gameId}: ${JSON.stringify(allClues.map(clue => ({
        _id: clue._id,
        order: clue.order,
        title: clue.title
      })), null, 2)}`);
    } else {
      console.log(`Primera pista encontrada: ${JSON.stringify({
        _id: firstClue._id,
        order: firstClue.order,
        status: firstClue.status,
        title: firstClue.title
      }, null, 2)}`);
    }

    // Si hay una primera pista, registrar su descubrimiento
    if (firstClue) {
      const clueProgress = {
        clueId: firstClue._id as Types.ObjectId,
        status: ClueStatus.DISCOVERED,
        discoveredAt: new Date(),
      };

      // Evitar duplicados solo si el documento ya tiene pistas
      const clueExists = playerProgress.clues.some(clue => clue.clueId.toString() === firstClue._id.toString());
      if (!clueExists) {
        playerProgress.clues.push(clueProgress);
        console.log(`Pista ${firstClue._id} añadida al progreso del jugador ${playerId}`);
      } else {
        console.log(`Pista ${firstClue._id} ya estaba en el progreso del jugador ${playerId}`);
      }

      // Actualizar el estado de la pista en la colección Clue
      firstClue.discoveredBy = new Types.ObjectId(playerId);
      firstClue.discoveredAt = new Date();
      firstClue.status = ClueStatus.DISCOVERED;
      await firstClue.save();

      // Actualizar los metadatos del juego
      game.metadata.completedClues = await this.clueModel.countDocuments({
        gameId: new Types.ObjectId(gameId),
        status: ClueStatus.DISCOVERED,
      }).exec();
      game.metadata.lastActivity = new Date();
      await game.save();
    }

    // Guardar el progreso del jugador
    const savedPlayerProgress = await playerProgress.save();

    // Validar que la pista se guardó correctamente
    if (firstClue && !savedPlayerProgress.clues.find(clue => clue.clueId.toString() === firstClue._id.toString())) {
      console.error(`Error: La pista ${firstClue._id} no se almacenó en PlayerProgress para el jugador ${playerId}`);
      console.log(`Contenido de savedPlayerProgress.clues: ${JSON.stringify(savedPlayerProgress.clues, null, 2)}`);
    }

    return {
      game,
      firstClue,
    };
  }

  async leaveGame(gameId: string, playerId: string): Promise<Game> {
    const game = await this.gameModel.findById(gameId).exec();

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    game.playerIds = game.playerIds.filter(id => id !== playerId);
    game.metadata.lastActivity = new Date();

    return game.save();
  }

  async startGame(gameId: string): Promise<Game> {
    const game = await this.gameModel.findById(gameId).exec();

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    if (game.status !== 'waiting') {
      throw new BadRequestException('Game cannot be started');
    }

    // ✅ REGLA: el juego debe tener una subasta antes de poder iniciarse
    const auction = await this.auctionModel
      .findOne({ gameId: new Types.ObjectId(gameId) })
      .exec();

    if (!auction) {
      throw new BadRequestException(
        'No se puede iniciar el juego: primero debe crear una subasta para este juego.',
      );
    }

    // ✅ REGLA: la subasta debe haber cerrado (fecha de cierre ya pasó)
    const now = new Date();
    if (auction.closingDate > now) {
      throw new BadRequestException(
        `No se puede iniciar el juego: la subasta aún no ha cerrado. ` +
        `Cierra el ${auction.closingDate.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}.`,
      );
    }

    // ✅ REGLA: todas las pistas del juego (subastadas y no subastadas) deben
    // haber sido finalizadas (setupStatus = UPDATED) antes de iniciar.
    const pendingClues = await this.clueModel
      .find({
        gameId: new Types.ObjectId(gameId),
        setupStatus: { $ne: ClueSetupStatus.UPDATED },
      })
      .select('title order')
      .sort({ order: 1 })
      .exec();

    if (pendingClues.length > 0) {
      const nombres = pendingClues.map(c => c.title).join(', ');
      throw new BadRequestException(
        `No se puede iniciar el juego: faltan ${pendingClues.length} pista(s) por finalizar su ` +
        `información tras la subasta: ${nombres}.`,
      );
    }

    // ✅ REGLA: asignar el sponsor ganador a cada pista que recibió pujas.
    // Las pistas sin pujas no bloquean el inicio; simplemente quedan sin sponsor.
    for (const biddableClue of auction.biddableClues) {
      if (!biddableClue.currentBidderId) continue;

      biddableClue.isWon = true;

      const existingAssociation = await this.gameSponsorModel
        .findOne({
          gameId: new Types.ObjectId(gameId),
          sponsorId: biddableClue.currentBidderId,
          clueId: biddableClue.clueId,
        })
        .exec();

      if (!existingAssociation) {
        await this.gameSponsorModel.create({
          gameId: new Types.ObjectId(gameId),
          sponsorId: biddableClue.currentBidderId,
          clueId: biddableClue.clueId,
          sponsorshipType: 'secondary',
          sponsorshipAmount: biddableClue.currentBid,
          totalUnlocks: 0,
          unlockedFor: [],
          isActive: true,
        });
      }
    }

    if (auction.status !== AuctionStatus.FINISHED) {
      auction.status = AuctionStatus.FINISHED;
    }
    auction.markModified('biddableClues');
    await auction.save();

    game.status = GameStatus.ACTIVE;
    game.startedAt = new Date();
    game.metadata.lastActivity = new Date();

    return game.save();
  }

  async getPlayerGames(playerId: string): Promise<{
    success: boolean;
    message: string;
    data: any[];
    count: number;
  }> {
    console.log("ejecucion")
    try {
      // Buscar todos los documentos de PlayerProgress para el jugador
      const playerProgresses = await this.playerProgressModel
        .find({ playerId })
        .populate({
          path: 'gameId',
          model: 'Game',
          select: 'name description status createdAt updatedAt metadata playerIds adminId maxPlayers clues', // Incluimos campos requeridos por el frontend
        })
        .populate({
          path: 'clues.clueId',
          model: 'Clue',
          select: 'title description order status discoveredAt discoveredBy gameId idPista type imageUrl', // Incluimos todos los campos requeridos por Clue
        })
        .exec();

      // Formatear la respuesta
      const games = playerProgresses.map(progress => {
        const game = progress.gameId as any; // GameDocument
        const discoveredClues = progress.clues
          .filter(clue => clue.status === ClueStatus.DISCOVERED)
          .map(clue => ({
            clueId: clue.clueId._id.toString(), // Convertir ObjectId a string
            title: (clue.clueId as any).title,
            description: (clue.clueId as any).description,
            order: (clue.clueId as any).order,
            status: clue.status,
            discoveredAt: clue.discoveredAt ? clue.discoveredAt.toISOString() : null,
            discoveredBy: (clue.clueId as any).discoveredBy, // Asegúrate de incluir discoveredBy
            gameId: (clue.clueId as any).gameId, // Incluir gameId
            idPista: (clue.clueId as any).idPista || `UNKNOWN_${clue.clueId._id}`, // Incluir idPista
            type: (clue.clueId as any).type || 'text', // Incluir tipo por defecto
            imageUrl: (clue.clueId as any).imageUrl || null, 
          }));

        return {
          gameId: game._id.toString(), // Convertir ObjectId a string
          name: game.name,
          description: game.description,
          status: game.status,
          createdAt: game.createdAt.toISOString(),
          updatedAt: game.updatedAt.toISOString(),
          totalClues: game.metadata?.totalClues || 0,
          completedClues: game.metadata?.completedClues || 0,
          discoveredClues,
          discoveredCluesCount: discoveredClues.length,
          playerIds: game.playerIds || [], // Incluir playerIds
          adminId: game.adminId || '', // Incluir adminId
          maxPlayers: game.maxPlayers || 0, // Incluir maxPlayers
          clues: game.clues || [], // Incluir lista de clue IDs
        };
      });

      return {
        success: true,
        message: 'Juegos del jugador obtenidos exitosamente',
        data: games,
        count: games.length,
      };
    } catch (error) {
      throw new BadRequestException(`Error al obtener los juegos del jugador: ${error.message}`);
    }
  }

  // Agregar este método al GamesService (games.service.ts)

  // Agregar este método al GamesService (games.service.ts)

  // Agregar este método al GamesService (games.service.ts)
  // Método discoverClue actualizado con validación de proximidad
  async discoverClue(
    clueId: string,
    playerId: string,
    playerLatitude: number,
    playerLongitude: number
  ): Promise<{
    clue: Clue;
    gameProgress: any;
    isGameCompleted: boolean;
    isCollaborative?: boolean;
    collaborativeStatus?: {
      currentParticipants: number;
      requiredParticipants: number;
      timeRemaining: number;
      status: string;
      participantIds: string[];
    };
    proximityInfo?: {
      distance: number;
      range: number;
      isWithinRange: boolean;
    };
  }> {
    try {
      // 1. Validar que clueId sea un ObjectId válido
      if (!Types.ObjectId.isValid(clueId)) {
        throw new BadRequestException(`ID de pista inválido: ${clueId}`);
      }

      // 2. Validar coordenadas del jugador
      if (playerLatitude < -90 || playerLatitude > 90) {
        throw new BadRequestException('Latitud del jugador inválida (debe estar entre -90 y 90)');
      }
      if (playerLongitude < -180 || playerLongitude > 180) {
        throw new BadRequestException('Longitud del jugador inválida (debe estar entre -180 y 180)');
      }

      // 3. Buscar la pista
      const clue = await this.clueModel.findById(clueId).exec();
      if (!clue) {
        throw new NotFoundException(`Pista con ID ${clueId} no encontrada`);
      }

      // 4. ✅ NUEVA VALIDACIÓN: Verificar proximidad geográfica
      this.validateProximity(clue, playerLatitude, playerLongitude);

      // 5. Buscar el juego al que pertenece la pista
      const game = await this.gameModel.findById(clue.gameId).populate('clues').exec();
      if (!game) {
        throw new NotFoundException(`Juego asociado a la pista no encontrado`);
      }

      // 6. Verificar que el jugador esté suscrito al juego
      if (!game.playerIds.includes(playerId)) {
        throw new BadRequestException('El jugador no está suscrito a este juego');
      }

      // 7. Verificar que el juego esté activo
      if (game.status !== GameStatus.ACTIVE) {
        throw new BadRequestException('Solo se pueden descubrir pistas en juegos activos');
      }

      // 8. Calcular información de proximidad para incluir en la respuesta
      const distance = this.calculateDistance(
        playerLatitude,
        playerLongitude,
        clue.location.latitude,
        clue.location.longitude
      );

      const proximityInfo = {
        distance,
        range: clue.range,
        isWithinRange: distance <= clue.range
      };

      // 9. ✅ LÓGICA EXISTENTE: Verificar si es una pista colaborativa
      if (clue.isCollaborative) {
        const result = await this.handleCollaborativeClue(clue, playerId, game);
        return {
          ...result,
          proximityInfo
        };
      }

      // 10. ✅ LÓGICA EXISTENTE: Para pistas normales
      const result = await this.handleNormalClue(clue, playerId, game);
      return {
        ...result,
        proximityInfo
      };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al descubrir la pista: ${error.message}`);
    }
  }


  private async handleCollaborativeClue(clue: ClueDocument, playerId: string, game: GameDocument): Promise<any> {
    // 1. Verificar orden secuencial (mismo que pistas normales)
    await this.validateClueOrder(clue, playerId, game);

    // 2. Limpiar intentos expirados antes de procesar
    await this.expireOldCollaborativeAttempts();

    // 3. Buscar intento activo existente o crear uno nuevo
    let collaborativeAttempt = await this.findOrCreateCollaborativeAttempt(clue, playerId);

    // 4. Agregar jugador al intento si no está ya
    collaborativeAttempt = await this.addPlayerToCollaborativeAttempt(collaborativeAttempt, playerId);

    // 5. Verificar si se completó el requisito
    const isCompleted = collaborativeAttempt.participantIds.length >= collaborativeAttempt.requiredPlayers;

    if (isCompleted && collaborativeAttempt.status === CollaborativeAttemptStatus.ACTIVE) {
      // Completar la pista para todos los participantes
      await this.completeCollaborativeAttempt(collaborativeAttempt, clue, game);
    }

    // 6. Calcular tiempo restante
    const now = new Date();
    const timeRemaining = Math.max(0, collaborativeAttempt.expiresAt.getTime() - now.getTime());

    // 7. ✅ RESTAURADO: Calcular progreso del juego igual que pistas normales
    const playerProgress = await this.playerProgressModel.findOne({
      gameId: clue.gameId,
      playerId: playerId
    }).exec();

    if (!playerProgress) {
      throw new NotFoundException('Progreso del jugador no encontrado');
    }

    // Buscar la siguiente pista (solo para verificaciones internas)
    const nextClue = await this.clueModel.findOne({
      gameId: clue.gameId,
      order: clue.order + 1
    }).exec();

    // Verificar si el juego está completo
    const allGameClues = await this.clueModel.find({
      gameId: clue.gameId
    }).sort({ order: 1 }).exec();

    const totalGameClues = allGameClues.length;
    const playerDiscoveredCount = playerProgress.clues.filter(
      pc => pc.status === ClueStatus.DISCOVERED
    ).length;
    const isGameCompleted = playerDiscoveredCount === totalGameClues;

    // Si el jugador completó todas las pistas, marcar el juego como completado
    if (isGameCompleted) {
      game.status = GameStatus.COMPLETED;
      game.finishedAt = new Date();
      await game.save();
      await this.processGameCompletionAchievements(game._id as Types.ObjectId);
      // await this.createPlayerAchievement(playerId, game);
    }

    // Crear resumen del progreso del juego
    const gameProgress = {
      totalClues: totalGameClues,
      discoveredClues: playerDiscoveredCount,
      progress: totalGameClues > 0 ? (playerDiscoveredCount / totalGameClues) * 100 : 0,
      hasMoreClues: nextClue !== null,
    };

    // 8. Preparar respuesta
    const collaborativeStatus = {
      currentParticipants: collaborativeAttempt.participantIds.length,
      requiredParticipants: collaborativeAttempt.requiredPlayers,
      timeRemaining,
      status: isCompleted ? 'completed' : (timeRemaining > 0 ? 'waiting' : 'expired'),
      participantIds: collaborativeAttempt.participantIds,
    };

    return {
      clue,
      gameProgress,
      isGameCompleted,
      isCollaborative: true,
      collaborativeStatus,
    };
  }


  async handleNormalClue(clue: ClueDocument, playerId: string, game: GameDocument): Promise<any> {
    // Toda la lógica existente hasta el punto de validación de orden...
    await this.validateClueOrder(clue, playerId, game);

    // Buscar el progreso del jugador
    let playerProgress = await this.playerProgressModel.findOne({
      gameId: clue.gameId,
      playerId: playerId
    }).exec();

    if (!playerProgress) {
      throw new NotFoundException('Progreso del jugador no encontrado');
    }

    // Verificar que el jugador no haya descubierto ya esta pista
    const alreadyDiscovered = playerProgress.clues.some(
      progressClue => progressClue.clueId.toString() === clue._id.toString() &&
        progressClue.status === ClueStatus.DISCOVERED
    );

    if (alreadyDiscovered) {
      throw new BadRequestException('El jugador ya ha descubierto esta pista');
    }

    // ✅ NUEVA VALIDACIÓN CRÍTICA: Verificar que el juego sigue activo justo antes de procesar
    const freshGame = await this.gameModel.findById(game._id).exec();
    if (!freshGame) {
      throw new NotFoundException('Juego no encontrado');
    }

    if (freshGame.status !== GameStatus.ACTIVE) {
      throw new BadRequestException('El juego ya fue completado por otro jugador');
    }

    // Marcar la pista como descubierta
    clue.discoveredBy = new Types.ObjectId(playerId);
    clue.discoveredAt = new Date();
    clue.status = ClueStatus.DISCOVERED;
    await clue.save();

    // Actualizar el progreso del jugador
    const clueProgressIndex = playerProgress.clues.findIndex(
      pc => pc.clueId.toString() === clue._id.toString()
    );

    if (clueProgressIndex >= 0) {
      playerProgress.clues[clueProgressIndex].status = ClueStatus.DISCOVERED;
      playerProgress.clues[clueProgressIndex].discoveredAt = new Date();
    } else {
      playerProgress.clues.push({
        clueId: new Types.ObjectId(clue._id.toString()),
        status: ClueStatus.DISCOVERED,
        discoveredAt: new Date(),
      });
    }

    playerProgress.lastActivity = new Date();
    await playerProgress.save();

    // Calcular si el jugador completó todas las pistas
    const allGameClues = await this.clueModel.find({
      gameId: clue.gameId
    }).sort({ order: 1 }).exec();

    const totalGameClues = allGameClues.length;
    const playerDiscoveredCount = playerProgress.clues.filter(
      pc => pc.status === ClueStatus.DISCOVERED
    ).length;
    const isGameCompleted = playerDiscoveredCount === totalGameClues;

    // ✅ SOLUCIÓN CRÍTICA: Manejo atómico del ganador
    let isWinner = false;
    let gameStatusMessage = '';

    if (isGameCompleted) {
      // ✅ VERIFICACIÓN ATÓMICA: Solo el primer jugador en llegar puede ganar
      const atomicWinResult = await this.attemptToWinGame(freshGame._id.toString(), playerId);

      if (atomicWinResult.isWinner) {
        isWinner = true;
        gameStatusMessage = '🏆 ¡Felicitaciones! Has ganado el juego al completar todas las pistas.';

        // Procesar achievements del ganador
        await this.processPlayerCompletionAchievements(playerId, freshGame._id as Types.ObjectId);
      } else {
        gameStatusMessage = `Has completado todas las pistas, pero ${atomicWinResult.winnerId || 'otro jugador'} ya ganó el juego.`;

        // Procesar achievements de participación (no ganador)
        await this.processPlayerParticipationAchievements(playerId, freshGame._id as Types.ObjectId);
      }
    }

    // Actualizar metadatos del juego
    const totalDiscoveredClues = await this.clueModel.countDocuments({
      gameId: clue.gameId,
      status: ClueStatus.DISCOVERED
    }).exec();

    freshGame.metadata.completedClues = totalDiscoveredClues;
    freshGame.metadata.lastActivity = new Date();
    await freshGame.save();

    // Buscar la siguiente pista (solo para verificaciones internas)
    const nextClue = await this.clueModel.findOne({
      gameId: clue.gameId,
      order: clue.order + 1
    }).exec();

    // Crear resumen del progreso del juego
    const gameProgress = {
      totalClues: totalGameClues,
      discoveredClues: playerDiscoveredCount,
      progress: totalGameClues > 0 ? (playerDiscoveredCount / totalGameClues) * 100 : 0,
      hasMoreClues: nextClue !== null,

      // ✅ NUEVA INFORMACIÓN DE ESTADO
      isWinner: isWinner,
      gameCompleted: isGameCompleted,
      statusMessage: gameStatusMessage
    };

    return {
      clue,
      gameProgress,
      isGameCompleted,
    };
  }

  // ✅ 2. NUEVO MÉTODO: Verificación atómica para determinar ganador único
  private async attemptToWinGame(gameId: string, playerId: string): Promise<{
    isWinner: boolean;
    winnerId: string | null;
  }> {
    try {
      // ✅ OPERACIÓN ATÓMICA: Solo actualizar si el juego AÚN está activo
      const updateResult = await this.gameModel.findOneAndUpdate(
        {
          _id: gameId,
          status: GameStatus.ACTIVE  // ← CONDICIÓN CRÍTICA: Solo si está activo
        },
        {
          status: GameStatus.COMPLETED,
          finishedAt: new Date(),
          winnerId: playerId  // ← Necesitas agregar este campo al schema
        },
        { new: true }
      ).exec();

      if (updateResult) {
        // ✅ ÉXITO: Este jugador ganó la carrera
        console.log(`🏆 ¡${playerId} ganó el juego ${updateResult.name}!`);
        return {
          isWinner: true,
          winnerId: playerId
        };
      } else {
        // ✅ FALLÓ: Otro jugador ya ganó, buscar quién fue
        const completedGame = await this.gameModel.findById(gameId).exec();
        console.log(`⏱️ ${playerId} completó todas las pistas, pero ${completedGame?.winnerId || 'otro jugador'} ya ganó`);

        return {
          isWinner: false,
          winnerId: completedGame?.winnerId || null
        };
      }
    } catch (error) {
      console.error('Error en attemptToWinGame:', error);
      return {
        isWinner: false,
        winnerId: null
      };
    }
  }

  private async processPlayerCompletionAchievements(playerId: string, gameId: Types.ObjectId): Promise<void> {
    try {
      const game = await this.gameModel.findById(gameId).exec();
      if (!game) return;

      const allGameClues = await this.clueModel.find({ gameId }).exec();
      const totalClues = allGameClues.length;

      const gameStartTime = game.startedAt || game.createdAt;
      const gameEndTime = new Date();
      const totalGameTimeMs = gameEndTime.getTime() - gameStartTime.getTime();
      const totalGameTimeMinutes = Math.round(totalGameTimeMs / (1000 * 60));

      const playerProgress = await this.playerProgressModel.findOne({
        gameId,
        playerId
      }).exec();

      if (!playerProgress) return;

      const playerStats = await this.calculatePlayerStats(
        playerId,
        gameId,
        playerProgress,
        0
      );

      const baseGameDetails = {
        name: game.name,
        description: game.description,
        totalClues,
        startedAt: game.startedAt || game.createdAt,
        completionTimeMinutes: totalGameTimeMinutes,
        playerStats: {
          cluesDiscovered: playerStats.cluesDiscovered,
          collaborativeCluesParticipated: playerStats.collaborativeCluesParticipated,
          totalParticipants: game.playerIds.length
        }
      };

      // Crear AMBOS achievements para el ganador
      await this.createAchievementRecord(
        playerId,
        gameId,
        AchievementType.GAME_WIN,
        baseGameDetails
      );

      await this.createAchievementRecord(
        playerId,
        gameId,
        AchievementType.GAME_PARTICIPATION,
        baseGameDetails
      );

      console.log(`🏆 Achievements WIN + PARTICIPATION creados para ganador ${playerId}`);
    } catch (error) {
      console.error(`Error procesando achievements de ganador para ${playerId}:`, error);
    }
  }

  // ✅ 3. NUEVO MÉTODO: Achievements para jugadores que completan pero no ganan
  private async processPlayerParticipationAchievements(playerId: string, gameId: Types.ObjectId): Promise<void> {
    try {
      // Similar a processPlayerCompletionAchievements pero solo con PARTICIPATION, no WIN
      const game = await this.gameModel.findById(gameId).exec();
      if (!game) return;

      const allGameClues = await this.clueModel.find({ gameId }).exec();
      const totalClues = allGameClues.length;

      const gameStartTime = game.startedAt || game.createdAt;
      const gameEndTime = new Date();
      const totalGameTimeMs = gameEndTime.getTime() - gameStartTime.getTime();
      const totalGameTimeMinutes = Math.round(totalGameTimeMs / (1000 * 60));

      // Obtener estadísticas del jugador
      const playerProgress = await this.playerProgressModel.findOne({
        gameId,
        playerId
      }).exec();

      if (!playerProgress) return;

      const playerStats = await this.calculatePlayerStats(
        playerId,
        gameId,
        playerProgress,
        0 // No hay colaborativas como última pista
      );

      const baseGameDetails = {
        name: game.name,
        description: game.description,
        totalClues,
        startedAt: game.startedAt || game.createdAt,
        completionTimeMinutes: totalGameTimeMinutes,
        playerStats: {
          cluesDiscovered: playerStats.cluesDiscovered,
          collaborativeCluesParticipated: playerStats.collaborativeCluesParticipated,
          totalParticipants: game.playerIds.length
        }
      };

      // Solo crear PARTICIPATION achievement (no WIN)
      await this.createAchievementRecord(
        playerId,
        gameId,
        AchievementType.GAME_PARTICIPATION,
        baseGameDetails
      );

      console.log(`🎖️ Achievement PARTICIPATION creado para jugador ${playerId}`);
    } catch (error) {
      console.error(`Error procesando participation achievement para ${playerId}:`, error);
    }
  }

  // ✅ NUEVO MÉTODO: Manejar pistas normales (lógica existente extraída)
  /*private async handleNormalClue(clue: ClueDocument, playerId: string, game: GameDocument): Promise<any> {
    // Toda la lógica existente de discoverClue para pistas normales
    await this.validateClueOrder(clue, playerId, game);

    // Buscar el progreso del jugador
    let playerProgress = await this.playerProgressModel.findOne({
      gameId: clue.gameId,
      playerId: playerId
    }).exec();

    if (!playerProgress) {
      throw new NotFoundException('Progreso del jugador no encontrado');
    }

    // Verificar que el jugador no haya descubierto ya esta pista
    const alreadyDiscovered = playerProgress.clues.some(
      progressClue => progressClue.clueId.toString() === clue._id.toString() && 
                     progressClue.status === ClueStatus.DISCOVERED
    );

    if (alreadyDiscovered) {
      throw new BadRequestException('El jugador ya ha descubierto esta pista');
    }

    // Marcar la pista como descubierta
    clue.discoveredBy = new Types.ObjectId(playerId);
    clue.discoveredAt = new Date();
    clue.status = ClueStatus.DISCOVERED;
    await clue.save();

    // Actualizar el progreso del jugador
    const clueProgressIndex = playerProgress.clues.findIndex(
      pc => pc.clueId.toString() === clue._id.toString()
    );

    if (clueProgressIndex >= 0) {
      playerProgress.clues[clueProgressIndex].status = ClueStatus.DISCOVERED;
      playerProgress.clues[clueProgressIndex].discoveredAt = new Date();
    } else {
      playerProgress.clues.push({
        clueId: new Types.ObjectId(clue._id.toString()),
        status: ClueStatus.DISCOVERED,
        discoveredAt: new Date(),
      });
    }

    playerProgress.lastActivity = new Date();
    await playerProgress.save();

    // ✅ RESTAURADO: Actualizar metadatos del juego
    const totalDiscoveredClues = await this.clueModel.countDocuments({
      gameId: clue.gameId,
      status: ClueStatus.DISCOVERED
    }).exec();

    game.metadata.completedClues = totalDiscoveredClues;
    game.metadata.lastActivity = new Date();
    await game.save();

    // ✅ RESTAURADO: Buscar la siguiente pista (solo para verificaciones internas)
    const nextClue = await this.clueModel.findOne({
      gameId: clue.gameId,
      order: clue.order + 1
    }).exec();

    // ✅ RESTAURADO: Verificar si el juego está completo
    const allGameClues = await this.clueModel.find({
      gameId: clue.gameId
    }).sort({ order: 1 }).exec();

    const totalGameClues = allGameClues.length;
    const playerDiscoveredCount = playerProgress.clues.filter(
      pc => pc.status === ClueStatus.DISCOVERED
    ).length;
    const isGameCompleted = playerDiscoveredCount === totalGameClues;

    // ✅ RESTAURADO: Si el jugador completó todas las pistas, marcar el juego como completado
    if (isGameCompleted) {
      game.status = GameStatus.COMPLETED;
      game.finishedAt = new Date();
      await game.save();
      await this.processGameCompletionAchievements(game._id as Types.ObjectId);
       //await this.createPlayerAchievement(playerId, game);
    }

    // ✅ RESTAURADO: Crear resumen del progreso del juego (sin información de la siguiente pista)
    const gameProgress = {
      totalClues: totalGameClues,
      discoveredClues: playerDiscoveredCount,
      progress: totalGameClues > 0 ? (playerDiscoveredCount / totalGameClues) * 100 : 0,
      hasMoreClues: nextClue !== null, // Solo indica si hay más pistas, sin revelar información
    };

    return {
      clue,
      gameProgress,
      isGameCompleted,
    };
  }
*/


  // ✅ NUEVO MÉTODO: Validar orden secuencial de pistas
  private async validateClueOrder(clue: ClueDocument, playerId: string, game: GameDocument): Promise<void> {
    const playerProgress = await this.playerProgressModel.findOne({
      gameId: clue.gameId,
      playerId: playerId
    }).exec();

    if (!playerProgress) {
      throw new NotFoundException('Progreso del jugador no encontrado');
    }

    // Obtener todas las pistas del juego ordenadas
    const allGameClues = await this.clueModel.find({
      gameId: clue.gameId
    }).sort({ order: 1 }).exec();

    // Encontrar las pistas que el jugador ha descubierto (ordenadas por order)
    const discoveredClueIds = playerProgress.clues
      .filter(pc => pc.status === ClueStatus.DISCOVERED)
      .map(pc => pc.clueId.toString());

    const discoveredClues = allGameClues.filter(gc =>
      discoveredClueIds.includes(gc._id.toString())
    );

    // Determinar cuál debería ser la siguiente pista según el orden
    let expectedNextOrder = 0;
    if (discoveredClues.length > 0) {
      const maxDiscoveredOrder = Math.max(...discoveredClues.map(dc => dc.order));
      expectedNextOrder = maxDiscoveredOrder + 1;
    }

    // Verificar que la pista actual sea la que sigue en el orden
    if (clue.order !== expectedNextOrder) {
      throw new BadRequestException(
        `Esta no es la pista que sigue en el orden.`
      );
    }
  }

  // ✅ NUEVO MÉTODO: Buscar o crear intento colaborativo
  private async findOrCreateCollaborativeAttempt(clue: ClueDocument, playerId: string): Promise<CollaborativeAttemptDocument> {
    // Buscar intento activo existente
    let attempt = await this.collaborativeAttemptModel.findOne({
      clueId: clue._id,
      status: CollaborativeAttemptStatus.ACTIVE,
      expiresAt: { $gt: new Date() }
    }).exec();

    if (!attempt) {
      // Crear nuevo intento
      const now = new Date();
      console.log("tiempo : ", clue.collaborativeTimeLimit)
      //const expiresAt = new Date(now.getTime() + clue.collaborativeTimeLimit!);
      const expiresAt = new Date(now.getTime() + (clue.collaborativeTimeLimit! * 60 * 1000));
      attempt = new this.collaborativeAttemptModel({
        clueId: clue._id,
        gameId: clue.gameId,
        participantIds: [],
        requiredPlayers: clue.requiredPlayers!,
        startedAt: now,
        expiresAt,
        status: CollaborativeAttemptStatus.ACTIVE,
        initiatedBy: playerId,
      });

      await attempt.save();
    }

    return attempt;
  }

  // ✅ NUEVO MÉTODO: Agregar jugador a intento colaborativo
  private async addPlayerToCollaborativeAttempt(
    attempt: CollaborativeAttemptDocument,
    playerId: string
  ): Promise<CollaborativeAttemptDocument> {
    // Verificar si el jugador ya está en el intento
    if (!attempt.participantIds.includes(playerId)) {
      attempt.participantIds.push(playerId);
      await attempt.save();
    }

    return attempt;
  }

  // ✅ NUEVO MÉTODO: Completar intento colaborativo
  private async completeCollaborativeAttempt(
    attempt: CollaborativeAttemptDocument,
    clue: ClueDocument,
    game: GameDocument
  ): Promise<void> {
    // Marcar el intento como completado
    attempt.status = CollaborativeAttemptStatus.COMPLETED;
    attempt.completedAt = new Date();
    await attempt.save();

    // Marcar la pista como descubierta
    clue.status = ClueStatus.DISCOVERED;
    clue.discoveredAt = new Date();
    await clue.save();

    // Actualizar progreso para todos los participantes
    for (const participantId of attempt.participantIds) {
      await this.updatePlayerProgressForCollaborativeClue(clue, participantId);
    }

    // Actualizar metadatos del juego
    const totalDiscoveredClues = await this.clueModel.countDocuments({
      gameId: clue.gameId,
      status: ClueStatus.DISCOVERED
    }).exec();

    game.metadata.completedClues = totalDiscoveredClues;
    game.metadata.lastActivity = new Date();
    await game.save();

    await this.collaborativeAttemptModel.deleteOne({ _id: attempt._id }).exec();

  }

  // ✅ NUEVO MÉTODO: Actualizar progreso de jugador para pista colaborativa
  private async updatePlayerProgressForCollaborativeClue(clue: ClueDocument, playerId: string): Promise<void> {
    const playerProgress = await this.playerProgressModel.findOne({
      gameId: clue.gameId,
      playerId
    }).exec();

    if (!playerProgress) return;

    // Verificar si ya tiene la pista en su progreso
    const clueProgressIndex = playerProgress.clues.findIndex(
      pc => pc.clueId.toString() === clue._id.toString()
    );

    if (clueProgressIndex >= 0) {
      // Actualizar pista existente
      playerProgress.clues[clueProgressIndex].status = ClueStatus.DISCOVERED;
      playerProgress.clues[clueProgressIndex].discoveredAt = new Date();
    } else {
      // Agregar nueva pista al progreso
      playerProgress.clues.push({
        clueId: new Types.ObjectId(clue._id.toString()),
        status: ClueStatus.DISCOVERED,
        discoveredAt: new Date(),
      });
    }

    playerProgress.lastActivity = new Date();
    await playerProgress.save();
  }


  // ✅ NUEVO MÉTODO: Limpiar intentos expirados
  private async expireOldCollaborativeAttempts(): Promise<void> {
    const now = new Date();

    await this.collaborativeAttemptModel.updateMany(
      {
        status: CollaborativeAttemptStatus.ACTIVE,
        expiresAt: { $lt: now }
      },
      {
        $set: { status: CollaborativeAttemptStatus.EXPIRED }
      }
    ).exec();
  }


  // ✅ MÉTODO ACTUALIZADO: Obtener estado detallado de intento colaborativo
  async getCollaborativeStatus(clueId: string, gameId: string): Promise<any> {
    if (!Types.ObjectId.isValid(clueId) || !Types.ObjectId.isValid(gameId)) {
      throw new BadRequestException('IDs inválidos');
    }

    const clue = await this.clueModel.findById(clueId).exec();
    if (!clue || !clue.isCollaborative) {
      throw new BadRequestException('La pista no es colaborativa');
    }

    // 🔍 Verificar si la pista ya fue descubierta completamente
    const isClueDiscovered = clue.status === ClueStatus.DISCOVERED;

    // 📊 Información base de la pista
    const clueInfo = {
      id: clue._id,
      title: clue.title,
      description: clue.description,
      isCollaborative: true,
      requiredPlayers: clue.requiredPlayers,
      timeLimit: clue.collaborativeTimeLimit,
      isDiscovered: isClueDiscovered,
      discoveredAt: clue.discoveredAt || null
    };

    // 🔍 SIEMPRE buscar el intento colaborativo (activo, expirado o completado)
    console.log(`🔍 Buscando collaborative attempt para clueId: ${clueId}, gameId: ${gameId}`);
    console.log(`🔍 Tipos: clueId es ${typeof clueId}, gameId es ${typeof gameId}`);
    console.log(`🔍 ObjectId clueId: ${new Types.ObjectId(clueId)}`);
    console.log(`🔍 ObjectId gameId: ${new Types.ObjectId(gameId)}`);

    // ✅ Primero buscar con strings simples
    let attempt = await this.collaborativeAttemptModel.findOne({
      clueId: clueId,
      gameId: gameId
    })
      .sort({ startedAt: -1 })
      .exec();

    console.log(`📊 Búsqueda con strings - encontrado:`, !!attempt);

    // ✅ Si no encuentra, intentar con ObjectId
    if (!attempt) {
      attempt = await this.collaborativeAttemptModel.findOne({
        clueId: new Types.ObjectId(clueId),
        gameId: new Types.ObjectId(gameId)
      })
        .sort({ startedAt: -1 })
        .exec();
      console.log(`📊 Búsqueda con ObjectId - encontrado:`, !!attempt);
    }

    // ✅ DEBUG: Buscar TODOS los registros para ver qué hay
    const allAttempts = await this.collaborativeAttemptModel.find({}).exec();
    console.log(`🔍 TODOS los collaborative attempts en la BD:`, allAttempts.map(a => ({
      id: a._id,
      clueId: a.clueId.toString(),
      gameId: a.gameId.toString(),
      participantIds: a.participantIds,
      participantCount: a.participantIds.length,
      status: a.status,
      startedAt: a.startedAt,
      expiresAt: a.expiresAt
    })));

    console.log(`📊 Resultado FINAL de búsqueda attempt:`, attempt ? {
      id: attempt._id,
      participantIds: attempt.participantIds,
      currentParticipants: attempt.participantIds.length,
      status: attempt.status,
      requiredPlayers: attempt.requiredPlayers,
      expiresAt: attempt.expiresAt
    } : 'NO ENCONTRADO');

    // 🚫 Si no hay ningún intento registrado
    if (!attempt) {
      console.log(`❌ No se encontró attempt para clueId: ${clueId}, gameId: ${gameId}`);

      return {
        success: true,
        hasActiveAttempt: false,
        clue: clueInfo,
        collaborativeStatus: {
          currentParticipants: 0,
          requiredParticipants: clue.requiredPlayers,
          playersNeeded: clue.requiredPlayers,
          timeRemaining: {
            milliseconds: 0,
            seconds: 0,
            minutes: 0,
            formatted: "00:00"
          },
          status: isClueDiscovered ? 'already_discovered' : 'no_active_attempt',
          canJoin: !isClueDiscovered,
          message: isClueDiscovered
            ? 'Esta pista ya ha sido descubierta por un grupo colaborativo'
            : 'No hay ningún intento colaborativo activo para esta pista',
          debug: {
            searchedClueId: clueId,
            searchedGameId: gameId,
            foundAttempts: allAttempts.length,
            message: 'No se encontró el registro collaborative attempt en la BD'
          }
        }
      };
    }

    // ⏰ Calcular tiempo restante basado en la fecha real
    const now = new Date();
    const timeRemainingMs = Math.max(0, attempt.expiresAt.getTime() - now.getTime());
    const timeRemainingSeconds = Math.floor(timeRemainingMs / 1000);
    const minutes = Math.floor(timeRemainingSeconds / 60);
    const seconds = timeRemainingSeconds % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 📈 Información REAL de participantes (del registro en la BD)
    const currentParticipants = attempt.participantIds.length;
    const requiredParticipants = attempt.requiredPlayers;

    // 🎯 Determinar estado basado en los datos reales (PRIORIZAR participantes sobre estado de pista)
    let attemptStatus: string;
    let canJoin: boolean;
    let message: string;
    let hasActiveAttempt: boolean;

    // ✅ LÓGICA CORREGIDA: Primero verificar participantes, luego tiempo
    if (currentParticipants >= requiredParticipants) {
      // Se alcanzó el número requerido - REALMENTE completado
      attemptStatus = 'completed';
      canJoin = false;
      hasActiveAttempt = false;
      message = `Esta pista fue completada colaborativamente por ${currentParticipants} jugador(es)`;
    } else if (timeRemainingMs <= 0) {
      // Tiempo expirado sin completar el requisito colaborativo
      attemptStatus = 'expired';
      canJoin = false;
      hasActiveAttempt = false;
      message = `El tiempo expiró. Participaron ${currentParticipants} de ${requiredParticipants} jugadores necesarios`;
    } else {
      // Aún activo y se pueden unir más jugadores
      attemptStatus = 'active';
      canJoin = true;
      hasActiveAttempt = true;
      const playersNeeded = requiredParticipants - currentParticipants;
      message = `Se necesitan ${playersNeeded} jugador(es) más para completar esta pista`;
    }

    // 🔍 NOTA ESPECIAL: Si la pista está descubierta pero no se completó colaborativamente
    if (isClueDiscovered && currentParticipants < requiredParticipants) {
      message += ` (Nota: La pista fue descubierta por otros medios, no colaborativamente)`;
    }

    // 📋 Respuesta completa con información REAL del intento
    return {
      success: true,
      hasActiveAttempt,
      clue: clueInfo,
      collaborativeStatus: {
        // 👥 Información REAL de participantes (del registro en BD)
        currentParticipants,  // ✅ Ahora mostrará el número correcto
        requiredParticipants,
        playersNeeded: Math.max(0, requiredParticipants - currentParticipants),

        // ⏰ Información de tiempo
        timeRemaining: {
          milliseconds: timeRemainingMs,
          seconds: timeRemainingSeconds,
          minutes,
          formatted: formattedTime,
          totalTimeLimit: clue.collaborativeTimeLimit
        },

        // 📊 Estado y control
        status: attemptStatus,
        canJoin,
        message,

        // 📅 Fechas importantes
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        initiatedBy: attempt.initiatedBy,

        // 🎯 Información adicional
        attemptId: attempt._id,
        isExpired: timeRemainingMs <= 0,
        isCompleted: currentParticipants >= requiredParticipants || isClueDiscovered
      }
    };
  }
  // Método auxiliar para verificar si todos los jugadores han completado el juego (opcional - ya no se usa)
  // Se mantiene para posibles usos futuros o análisis
  private async checkIfAllPlayersCompleted(gameId: string): Promise<boolean> {
    const game = await this.gameModel.findById(gameId).exec();
    if (!game) return false;

    const totalClues = await this.clueModel.countDocuments({ gameId }).exec();

    for (const playerId of game.playerIds) {
      const playerProgress = await this.playerProgressModel.findOne({
        gameId,
        playerId
      }).exec();

      if (!playerProgress) return false;

      const playerDiscoveredCount = playerProgress.clues.filter(
        pc => pc.status === ClueStatus.DISCOVERED
      ).length;

      if (playerDiscoveredCount < totalClues) {
        return false;
      }
    }

    return true;
  }

  async cleanupExpiredCollaborativeAttempts() {
    const now = new Date();

    // Opción 1: Eliminar registros expirados
    const result = await this.collaborativeAttemptModel.deleteMany({
      expiresAt: { $lt: now },
      status: CollaborativeAttemptStatus.ACTIVE
    });

    // Opción 2: Marcar como expirados (mantener historial)
    // const result = await this.collaborativeAttemptModel.updateMany(
    //   { expiresAt: { $lt: now }, status: CollaborativeAttemptStatus.ACTIVE },
    //   { status: CollaborativeAttemptStatus.EXPIRED }
    // );

    return result;
  }

  /**
     * Crea un achievement cuando un jugador gana un juego
     */
  private async createPlayerAchievement(playerId: string, game: GameDocument): Promise<void> {
    try {
      // Calcular tiempo de completion en minutos
      const completionTimeMs = game.finishedAt.getTime() - game.startedAt.getTime();
      const completionTimeMinutes = Math.round(completionTimeMs / (1000 * 60)); // Convertir a minutos

      const achievement = new this.playerAchievementModel({
        playerId,
        gameId: game._id,
        achievementType: AchievementType.GAME_WIN,
        completedAt: game.finishedAt,
        gameDetails: {
          name: game.name,
          description: game.description,
          totalClues: game.metadata.totalClues,
          startedAt: game.startedAt,
          completionTimeMinutes: completionTimeMinutes
        }
      });

      await achievement.save();
      console.log(`🏆 Achievement creado para jugador ${playerId} en juego ${game.name} - Tiempo: ${completionTimeMinutes} minutos`);
    } catch (error) {
      console.error('Error creando achievement:', error);
      // No lanzar error para no afectar el flujo principal del juego
    }
  }

  /**
    * Obtiene la cantidad de juegos ganados y detalles de victorias de un jugador
    */
  async getPlayerWins(playerId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      totalWins: number;
      allWins: any[];
    };
  }> {
    try {
      const playerWins = await this.playerAchievementModel
        .find({
          playerId,
          achievementType: AchievementType.GAME_WIN
        })
        .populate({
          path: 'gameId',
          model: 'Game',
          select: 'name description status createdAt'
        })
        .sort({ completedAt: -1 })
        .exec();

      const formattedWins = playerWins.map(win => ({
        achievementId: win._id,
        gameId: win.gameId,
        completedAt: win.completedAt.toISOString(),
        gameDetails: {
          name: win.gameDetails.name,
          description: win.gameDetails.description,
          totalClues: win.gameDetails.totalClues,
          startedAt: win.gameDetails.startedAt.toISOString(),
          completionTimeMinutes: win.gameDetails.completionTimeMinutes,
          completionTimeFormatted: this.formatCompletionTime(win.gameDetails.completionTimeMinutes)
        }
      }));

      return {
        success: true,
        message: 'Victorias del jugador obtenidas exitosamente',
        data: {
          totalWins: playerWins.length,
          allWins: formattedWins
        }
      };
    } catch (error) {
      throw new BadRequestException(`Error al obtener las victorias del jugador: ${error.message}`);
    }
  }


  /**
   * Formatea el tiempo de completion a formato legible (input en minutos)
   */
  private formatCompletionTime(totalMinutes: number): string {
    if (totalMinutes < 1) {
      return 'Menos de 1 minuto';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Obtiene estadísticas generales de achievements de un jugador
   */
  /**
 * Obtiene estadísticas generales de achievements de un jugador incluyendo gameDetails
 */
  /**
   * Obtiene estadísticas generales de achievements de un jugador incluyendo gameDetails
   */
  /**
   * Obtiene estadísticas generales de achievements de un jugador incluyendo gameDetails
   */
  async getPlayerAchievementStats(playerId: string): Promise<any> {
    try {
      const stats = await this.playerAchievementModel.aggregate([
        { $match: { playerId } },
        {
          $sort: { completedAt: -1 } // Ordenar por fecha más reciente primero
        },
        {
          $group: {
            _id: '$achievementType',
            count: { $sum: 1 },
            lastAchieved: { $max: '$completedAt' },
            // Para game_participation: obtener todos los gameDetails
            // Para otros types: solo el más reciente
            allGameDetails: {
              $push: {
                gameDetails: '$gameDetails',
                gameId: '$gameId',
                achievementId: '$_id',
                completedAt: '$completedAt'
              }
            },
            // Mantener campos para compatibilidad con otros achievement types
            latestGameDetails: { $first: '$gameDetails' },
            latestGameId: { $first: '$gameId' },
            latestAchievementId: { $first: '$_id' }
          }
        }
      ]).exec();

      // Obtener todos los game wins del jugador para verificar qué juegos ganó
      const gameWins = await this.playerAchievementModel.find({
        playerId,
        achievementType: AchievementType.GAME_WIN
      }).select('gameId').exec();

      // Crear un Set con los IDs de juegos ganados para búsqueda rápida
      const wonGameIds = new Set(gameWins.map(win => win.gameId.toString()));

      return {
        success: true,
        data: stats.reduce((acc, stat) => {
          if (stat._id === 'game_participation') {
            // Para game_participation: incluir todos los juegos con indicador de victoria
            acc[stat._id] = {
              count: stat.count,
              lastAchieved: stat.lastAchieved,
              allGames: stat.allGameDetails.map(game => ({
                gameId: game.gameId,
                achievementId: game.achievementId,
                completedAt: game.completedAt,
                isWinner: wonGameIds.has(game.gameId.toString()), // ✅ NUEVO CAMPO
                gameDetails: {
                  name: game.gameDetails.name,
                  description: game.gameDetails.description,
                  totalClues: game.gameDetails.totalClues,
                  startedAt: game.gameDetails.startedAt,
                  completionTimeMinutes: game.gameDetails.completionTimeMinutes,
                  completionTimeFormatted: this.formatCompletionTime(game.gameDetails.completionTimeMinutes),
                  playerStats: {
                    cluesDiscovered: game.gameDetails.playerStats.cluesDiscovered,
                    collaborativeCluesParticipated: game.gameDetails.playerStats.collaborativeCluesParticipated,
                    totalParticipants: game.gameDetails.playerStats.totalParticipants
                  }
                }
              }))
            };
          } else {
            // Para otros achievement types: solo el más reciente
            acc[stat._id] = {
              count: stat.count,
              lastAchieved: stat.lastAchieved,
              latestGameDetails: {
                name: stat.latestGameDetails.name,
                description: stat.latestGameDetails.description,
                totalClues: stat.latestGameDetails.totalClues,
                startedAt: stat.latestGameDetails.startedAt,
                completionTimeMinutes: stat.latestGameDetails.completionTimeMinutes,
                completionTimeFormatted: this.formatCompletionTime(stat.latestGameDetails.completionTimeMinutes),
                playerStats: {
                  cluesDiscovered: stat.latestGameDetails.playerStats.cluesDiscovered,
                  collaborativeCluesParticipated: stat.latestGameDetails.playerStats.collaborativeCluesParticipated,
                  totalParticipants: stat.latestGameDetails.playerStats.totalParticipants
                }
              },
              latestGameId: stat.latestGameId,
              latestAchievementId: stat.latestAchievementId
            };
          }
          return acc;
        }, {})
      };
    } catch (error) {
      throw new BadRequestException(`Error al obtener estadísticas de achievements: ${error.message}`);
    }
  }
  /**
   * Procesa logros para todos los jugadores cuando un juego se completa
   */
  private async processGameCompletionAchievements(gameId: string | Types.ObjectId): Promise<void> {
    try {
      // Asegurar que gameId sea ObjectId
      const gameObjectId = typeof gameId === 'string' ? new Types.ObjectId(gameId) : gameId;

      // 1. Obtener información completa del juego
      const game = await this.gameModel.findById(gameObjectId).exec();
      if (!game) {
        console.error(`Juego con ID ${gameId} no encontrado para procesar logros`);
        return;
      }

      // 2. Obtener todas las pistas del juego
      const allGameClues = await this.clueModel.find({ gameId: gameObjectId }).exec();
      const totalClues = allGameClues.length;
      const collaborativeClues = allGameClues.filter(clue => clue.isCollaborative);
      const totalCollaborativeClues = collaborativeClues.length;

      // 3. Calcular tiempo total del juego en minutos
      const gameStartTime = game.startedAt || game.createdAt;
      const gameEndTime = game.finishedAt || new Date();
      const totalGameTimeMs = gameEndTime.getTime() - gameStartTime.getTime();
      const totalGameTimeMinutes = Math.round(totalGameTimeMs / (1000 * 60));

      // 4. Procesar cada jugador participante
      for (const playerId of game.playerIds) {
        await this.processPlayerAchievements(
          playerId,
          game,
          gameObjectId, // Pasar el ObjectId correcto
          totalClues,
          totalCollaborativeClues,
          totalGameTimeMinutes
        );
      }

      console.log(`✅ Logros procesados para ${game.playerIds.length} jugadores en juego: ${game.name}`);
    } catch (error) {
      console.error('Error procesando logros de completion:', error);
    }
  }

  /**
   * Procesa los logros específicos de un jugador
   */
  private async processPlayerAchievements(
    playerId: string,
    game: GameDocument,
    gameObjectId: Types.ObjectId, // Añadir parámetro ObjectId
    totalClues: number,
    totalCollaborativeClues: number,
    totalGameTimeMinutes: number
  ): Promise<void> {
    try {
      // 1. Obtener progreso del jugador
      const playerProgress = await this.playerProgressModel.findOne({
        gameId: gameObjectId, // Usar ObjectId
        playerId
      }).exec();

      if (!playerProgress) {
        console.warn(`No se encontró progreso para jugador ${playerId} en juego ${gameObjectId}`);
        return;
      }

      // 2. Calcular estadísticas del jugador
      const playerStats = await this.calculatePlayerStats(
        playerId,
        gameObjectId, // Usar ObjectId
        playerProgress,
        totalCollaborativeClues
      );

      // 3. Crear objeto base de detalles del juego
      const baseGameDetails = {
        name: game.name,
        description: game.description,
        totalClues,
        startedAt: game.startedAt || game.createdAt,
        completionTimeMinutes: totalGameTimeMinutes,
        playerStats: {
          cluesDiscovered: playerStats.cluesDiscovered,
          collaborativeCluesParticipated: playerStats.collaborativeCluesParticipated,
          totalParticipants: game.playerIds.length
        }
      };

      // 4. Determinar y crear logros apropiados
      const achievements = this.determinePlayerAchievements(playerStats, totalClues);

      // 5. Crear achievements en la base de datos
      for (const achievementType of achievements) {
        await this.createAchievementRecord(
          playerId,
          gameObjectId, // Ahora usar el ObjectId correcto
          achievementType,
          baseGameDetails
        );
      }

      console.log(`🏆 Logros creados para jugador ${playerId}: ${achievements.join(', ')}`);
    } catch (error) {
      console.error(`Error procesando logros para jugador ${playerId}:`, error);
    }
  }

  /**
   * Calcula estadísticas específicas de un jugador
   */
  private async calculatePlayerStats(
    playerId: string,
    gameId: Types.ObjectId,
    playerProgress: PlayerProgressDocument,
    totalCollaborativeClues: number
  ): Promise<{
    cluesDiscovered: number;
    collaborativeCluesParticipated: number;
    completedAllClues: boolean;
  }> {
    // Contar pistas descubiertas por el jugador
    const discoveredClues = playerProgress.clues.filter(
      clue => clue.status === ClueStatus.DISCOVERED
    );
    const cluesDiscovered = discoveredClues.length;

    // Contar participación en pistas colaborativas
    const collaborativeCluesParticipated = await this.countCollaborativeParticipation(
      playerId,
      gameId
    );

    // Determinar si completó todas las pistas
    const allGameClues = await this.clueModel.find({ gameId }).exec();
    const completedAllClues = cluesDiscovered === allGameClues.length;

    return {
      cluesDiscovered,
      collaborativeCluesParticipated,
      completedAllClues
    };
  }

  /**
   * Cuenta en cuántas pistas colaborativas participó un jugador
   */
  private async countCollaborativeParticipation(
    playerId: string,
    gameId: Types.ObjectId
  ): Promise<number> {
    try {
      const collaborativeAttempts = await this.collaborativeAttemptModel.find({
        gameId,
        participantIds: playerId,
        status: CollaborativeAttemptStatus.COMPLETED
      }).exec();

      return collaborativeAttempts.length;
    } catch (error) {
      console.error('Error contando participación colaborativa:', error);
      return 0;
    }
  }

  /**
   * Determina qué logros merece un jugador basado en sus estadísticas
   */
  private determinePlayerAchievements(
    playerStats: any,
    totalClues: number
  ): AchievementType[] {
    const achievements: AchievementType[] = [];

    // GAME_WIN: Completó todas las pistas
    if (playerStats.completedAllClues) {
      achievements.push(AchievementType.GAME_WIN);
    }

    // GAME_PARTICIPATION: Participó en el juego (descubrió al menos 1 pista)
    if (playerStats.cluesDiscovered > 0) {
      achievements.push(AchievementType.GAME_PARTICIPATION);
    }

    return achievements;
  }


  /**
   * Crea un registro de achievement en la base de datos
   */
  private async createAchievementRecord(
    playerId: string,
    gameId: Types.ObjectId,
    achievementType: AchievementType,
    gameDetails: any
  ): Promise<void> {
    try {
      // Verificar si el jugador ya tiene este logro para este juego
      const existingAchievement = await this.playerAchievementModel.findOne({
        playerId,
        gameId,
        achievementType
      }).exec();

      if (existingAchievement) {
        console.log(`⚠️ Achievement ${achievementType} ya existe para jugador ${playerId} en juego ${gameId}`);
        return;
      }

      // Crear nuevo achievement
      const achievement = new this.playerAchievementModel({
        playerId,
        gameId,
        achievementType,
        completedAt: new Date(),
        gameDetails
      });

      await achievement.save();
      console.log(`✅ Achievement ${achievementType} creado para jugador ${playerId}`);
    } catch (error) {
      console.error(`Error creando achievement ${achievementType} para jugador ${playerId}:`, error);
    }
  }

  // Método helper para calcular distancia usando fórmula de Haversine
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance); // Retorna distancia en metros (redondeada)
  }
  // Método helper para convertir grados a radianes
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Método para validar proximidad geográfica
  private validateProximity(
    clue: ClueDocument,
    playerLatitude: number,
    playerLongitude: number
  ): void {
    // Verificar que la pista tenga ubicación definida
    if (!clue.location || clue.location.latitude === undefined || clue.location.longitude === undefined) {
      throw new BadRequestException(
        'Esta pista no tiene ubicación definida y no se puede descubrir por proximidad'
      );
    }

    // Verificar que la pista tenga rango definido
    if (clue.range === undefined || clue.range === null) {
      throw new BadRequestException(
        'Esta pista no tiene rango de descubrimiento definido'
      );
    }

    // Validar que el rango sea positivo
    if (clue.range <= 0) {
      throw new BadRequestException(
        'El rango de descubrimiento de esta pista es inválido'
      );
    }

    // ✅ LOGS DETALLADOS DE COORDENADAS
    console.log('📊 INFORMACIÓN DE UBICACIONES:');
    console.log('');
    console.log('👤 JUGADOR:');
    console.log('   Latitud:  ', playerLatitude);
    console.log('   Longitud: ', playerLongitude);
    console.log('   📍 Google Maps: https://www.google.com/maps?q=' + playerLatitude + ',' + playerLongitude);
    console.log('');
    console.log('🎯 PISTA (' + clue.title + '):');
    console.log('   ID:       ', clue._id);
    console.log('   Latitud:  ', clue.location.latitude);
    console.log('   Longitud: ', clue.location.longitude);
    console.log('   Rango:    ', clue.range + 'm');
    console.log('   📍 Google Maps: https://www.google.com/maps?q=' + clue.location.latitude + ',' + clue.location.longitude);
    console.log('');

    // Calcular distancia entre jugador y pista
    const distance = this.calculateDistance(
      playerLatitude,
      playerLongitude,
      clue.location.latitude,
      clue.location.longitude
    );

    // Validar que el jugador esté dentro del rango
    if (distance > clue.range) {
      throw new BadRequestException(
        `Estás demasiado lejos de esta pista. Distancia actual: ${distance}m, rango requerido: ${clue.range}m. Necesitas acercarte ${distance - clue.range}m más.`
      );
    }

    console.log(`✅ Validación de proximidad exitosa: jugador a ${distance}m de la pista (rango: ${clue.range}m)`);
  }


  /**
   * Obtiene todas las pistas colaborativas de un juego específico
   */
  async findCollaborativeClues(gameId: string): Promise<{
    gameId: string;
    gameName: string;
    totalCollaborativeClues: number;
    collaborativeClues: any[];
  }> {
    try {
      // 1. Validar que gameId sea un ObjectId válido
      if (!Types.ObjectId.isValid(gameId)) {
        throw new BadRequestException(`ID de juego inválido: ${gameId}`);
      }

      // 2. Verificar que el juego existe
      const game = await this.gameModel.findById(gameId).exec();
      if (!game) {
        throw new NotFoundException(`Juego con ID ${gameId} no encontrado`);
      }

      // 3. Buscar todas las pistas colaborativas del juego
      const collaborativeClues = await this.clueModel
        .find({
          gameId: new Types.ObjectId(gameId),
          isCollaborative: true
        })
        .sort({ order: 1 }) // Ordenar por orden de pista
        .select(
          '_id title description order requiredPlayers collaborativeTimeLimit status location range hint'
        )
        .exec();

      // 4. Formatear las pistas para la respuesta
      const formattedClues = collaborativeClues.map(clue => ({
        _id: clue._id.toString(),
        title: clue.title,
        description: clue.description,
        hint: clue.hint || null,
        order: clue.order,
        requiredPlayers: clue.requiredPlayers,
        collaborativeTimeLimit: clue.collaborativeTimeLimit,
        status: clue.status,
        location: clue.location ? {
          latitude: clue.location.latitude,
          longitude: clue.location.longitude,
          address: clue.location.address || null,
          description: clue.location.description || null
        } : null,
        range: clue.range || null
      }));

      // 5. Retornar resultado estructurado
      return {
        gameId: gameId,
        gameName: game.name,
        totalCollaborativeClues: collaborativeClues.length,
        collaborativeClues: formattedClues
      };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener pistas colaborativas: ${error.message}`);
    }
  }

  /**
    * Actualiza una pista específica de un juego
    * Solo permite modificar pistas cuando el juego está en estado WAITING
    */
  async updateClue(gameId: string, clueId: string, updateClueDto: any): Promise<Clue> {
    try {
      // 1. Validar que los IDs sean ObjectId válidos
      if (!Types.ObjectId.isValid(gameId)) {
        throw new BadRequestException(`ID de juego inválido: ${gameId}`);
      }
      if (!Types.ObjectId.isValid(clueId)) {
        throw new BadRequestException(`ID de pista inválido: ${clueId}`);
      }

      // 2. Verificar que el juego existe
      const game = await this.gameModel.findById(gameId).exec();
      if (!game) {
        throw new NotFoundException(`Juego con ID ${gameId} no encontrado`);
      }

      // 3. VALIDACIÓN CRÍTICA: Solo permitir modificación si el juego está en WAITING
      if (game.status !== GameStatus.WAITING) {
        throw new BadRequestException(
          `No se pueden modificar pistas de un juego en estado ${game.status}. Solo se permite en estado WAITING`
        );
      }

      // 4. Verificar que la pista existe
      const existingClue = await this.clueModel.findById(clueId).exec();
      if (!existingClue) {
        throw new NotFoundException(`Pista con ID ${clueId} no encontrada`);
      }

      // 5. Verificar que la pista pertenece al juego especificado
      if (existingClue.gameId.toString() !== gameId) {
        throw new BadRequestException('La pista no pertenece al juego especificado');
      }

      // 5.1 ✅ BLOQUEO: una pista finalizada no puede modificarse (estado final)
      if (existingClue.setupStatus === ClueSetupStatus.UPDATED) {
        throw new BadRequestException(
          'Esta pista ya fue finalizada y su información no puede modificarse.'
        );
      }

      // 6. Preparar datos de actualización
      const updateData: any = {};

      // Actualizar campos básicos si se proporcionan
      if (updateClueDto.title !== undefined) {
        updateData.title = updateClueDto.title;
      }
      if (updateClueDto.description !== undefined) {
        updateData.description = updateClueDto.description;
      }
      if (updateClueDto.imageUrl !== undefined) {
        updateData.imageUrl = updateClueDto.imageUrl;
      }

      // Manejar actualización de ubicación preservando campos existentes
      if (updateClueDto.location) {
        updateData.location = {
          latitude: updateClueDto.location.latitude,
          longitude: updateClueDto.location.longitude,
          // Preservar campos opcionales existentes
          address: existingClue.location?.address,
          description: existingClue.location?.description
        };
      }

      // 7. Actualizar la pista
      const updatedClue = await this.clueModel
        .findByIdAndUpdate(clueId, updateData, { new: true })
        .exec();

      if (!updatedClue) {
        throw new NotFoundException('Error al actualizar la pista');
      }

      // 8. Si se modificó la ubicación, recalcular el área del juego
      if (updateClueDto.location) {
        const gameArea = await this.calculateGameArea(game.clues as Types.ObjectId[]);
        if (gameArea) {
          game.gameArea = gameArea;
          game.metadata.lastActivity = new Date();
          await game.save();
        }
      } else {
        // Solo actualizar lastActivity si no se modificó ubicación
        game.metadata.lastActivity = new Date();
        await game.save();
      }

      return updatedClue;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar la pista: ${error.message}`);
    }
  }

  /**
   * Finaliza una pista: marca su preparación como UPDATED (estado final).
   * A partir de aquí la pista queda bloqueada y no puede modificarse.
   * Solo se permite cuando el juego está en WAITING y la subasta ya cerró.
   */
  async finalizeClue(gameId: string, clueId: string): Promise<Clue> {
    if (!Types.ObjectId.isValid(gameId)) {
      throw new BadRequestException(`ID de juego inválido: ${gameId}`);
    }
    if (!Types.ObjectId.isValid(clueId)) {
      throw new BadRequestException(`ID de pista inválido: ${clueId}`);
    }

    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new NotFoundException(`Juego con ID ${gameId} no encontrado`);
    }
    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException(
        `Solo se pueden finalizar pistas de un juego en estado WAITING (actual: ${game.status}).`
      );
    }

    // ✅ REGLA: solo se puede finalizar pistas después de que la subasta haya cerrado
    const auction = await this.auctionModel
      .findOne({ gameId: new Types.ObjectId(gameId) })
      .exec();
    if (!auction) {
      throw new BadRequestException(
        'No se pueden finalizar pistas: este juego aún no tiene una subasta.'
      );
    }
    if (auction.closingDate > new Date()) {
      throw new BadRequestException(
        'No se pueden finalizar pistas hasta que la subasta haya cerrado.'
      );
    }

    const clue = await this.clueModel.findById(clueId).exec();
    if (!clue) {
      throw new NotFoundException(`Pista con ID ${clueId} no encontrada`);
    }
    if (clue.gameId.toString() !== gameId) {
      throw new BadRequestException('La pista no pertenece al juego especificado');
    }
    if (clue.setupStatus === ClueSetupStatus.UPDATED) {
      throw new BadRequestException('Esta pista ya fue finalizada.');
    }

    clue.setupStatus = ClueSetupStatus.UPDATED;
    clue.finalizedAt = new Date();
    await clue.save();

    return clue;
  }

  /**
   * Devuelve, por cada pista del juego, la información de su sponsor.
   * - Si la pista tiene un sponsor asignado (ganó la subasta): nombre, celular y correo.
   * - Si la pista NO entró en subasta (sin asignación): el sponsor es el admin del juego.
   */
  async getGameCluesSponsors(gameId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(gameId)) {
      throw new BadRequestException(`ID de juego inválido: ${gameId}`);
    }

    const game = await this.gameModel.findById(gameId).exec();
    if (!game) {
      throw new NotFoundException(`Juego con ID ${gameId} no encontrado`);
    }

    // Info del admin del juego (para las pistas sin sponsor)
    const admin = Types.ObjectId.isValid(game.adminId)
      ? await this.userModel.findById(game.adminId).select('name email').exec()
      : null;

    // Pistas del juego, ordenadas
    const clues = await this.clueModel
      .find({ gameId: new Types.ObjectId(gameId) })
      .select('_id title order')
      .sort({ order: 1 })
      .exec();

    // Asignaciones de sponsor por pista (clueId != null)
    const associations = await this.gameSponsorModel
      .find({ gameId: new Types.ObjectId(gameId), clueId: { $ne: null } })
      .exec();

    const clueIdToSponsorId = new Map<string, string>();
    associations.forEach(a => {
      if (a.clueId) clueIdToSponsorId.set(a.clueId.toString(), a.sponsorId.toString());
    });

    // Cargar sponsors involucrados
    const sponsorIds = [...new Set([...clueIdToSponsorId.values()])];
    const sponsors = sponsorIds.length > 0
      ? await this.sponsorModel
          .find({ _id: { $in: sponsorIds.map(id => new Types.ObjectId(id)) } })
          .select('_id nombreEmpresa representanteLegal celular correo')
          .exec()
      : [];
    const sponsorMap = new Map(sponsors.map(s => [s._id.toString(), s]));

    return clues.map(clue => {
      const sponsorId = clueIdToSponsorId.get(clue._id.toString());
      const sponsor = sponsorId ? sponsorMap.get(sponsorId) : null;

      if (sponsor) {
        return {
          clueId: clue._id.toString(),
          clueTitle: clue.title,
          isAdmin: false,
          sponsorName: sponsor.nombreEmpresa,
          representanteLegal: sponsor.representanteLegal,
          celular: sponsor.celular,
          correo: sponsor.correo,
        };
      }

      // Sin asignación → el sponsor es el admin del juego
      return {
        clueId: clue._id.toString(),
        clueTitle: clue.title,
        isAdmin: true,
        sponsorName: admin?.name ?? 'Administrador',
        representanteLegal: null,
        celular: null,
        correo: admin?.email ?? null,
      };
    });
  }

  /**
   * Sube una imagen a Cloudinary para una pista
   */
  async uploadClueImage(gameId: string, clueId: string, file: Express.Multer.File): Promise<Clue> {
    try {
      // 1. Validar que el juego existe y está en WAITING
      const game = await this.gameModel.findById(gameId).exec();
      if (!game) {
        throw new NotFoundException(`Juego con ID ${gameId} no encontrado`);
      }
      if (game.status !== GameStatus.WAITING) {
        throw new BadRequestException('Solo se pueden subir imágenes en estado WAITING');
      }

      // 2. Verificar que la pista existe y pertenece al juego
      const clue = await this.clueModel.findById(clueId).exec();
      if (!clue) {
        throw new NotFoundException(`Pista con ID ${clueId} no encontrada`);
      }
      if (clue.gameId.toString() !== gameId) {
        throw new BadRequestException('La pista no pertenece al juego especificado');
      }
      if (clue.setupStatus === ClueSetupStatus.UPDATED) {
        throw new BadRequestException(
          'Esta pista ya fue finalizada y su imagen no puede modificarse.'
        );
      }

      // 3. Subir a Cloudinary (usando inyección retardada o importación si no se inyectó en constructor)
      // Nota: Como no actualicé el constructor para evitar breaking changes masivos si se usa en otros lados,
      // usaré una aproximación segura si es posible o actualizaré el constructor si es necesario.
      // Pero mejor actualizo el constructor para seguir las mejores prácticas.
      const uploadResult = await this.cloudinaryService.uploadFile(file);

      // 4. Actualizar la pista con la URL
      clue.imageUrl = uploadResult.secure_url;
      const updatedClue = await clue.save();

      // 5. Actualizar metadata del juego
      game.metadata.lastActivity = new Date();
      await game.save();

      return updatedClue;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al subir imagen: ${error.message}`);
    }
  }

}

