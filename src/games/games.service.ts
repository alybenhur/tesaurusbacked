import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Game, GameDocument, GameStatus } from './schemas/game.schema';
import { CreateGameDto, UpdateGameDto, JoinGameDto } from './dto/create-game.dto';
import { WebsocketsGateway } from '../websockets/websockets.gateway';

@Injectable()
export class GamesService {
  constructor(
    @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    @Inject(forwardRef(() => WebsocketsGateway))
    private websocketsGateway: WebsocketsGateway,
  ) {}

  async create(createGameDto: CreateGameDto): Promise<Game> {
    try {
      const gameData = {
        ...createGameDto,
        playerIds: [createGameDto.adminId], // Admin se une automáticamente
        gameArea: {
          center: { latitude: 8.7574, longitude: -75.8814 }, // Montería centro
          bounds: {
            northEast: { latitude: 8.7800, longitude: -75.8600 },
            southWest: { latitude: 8.7300, longitude: -75.9000 }
          }
        },
        metadata: {
          totalClues: 0,
          completedClues: 0,
          lastActivity: new Date()
        }
      };

      const createdGame = new this.gameModel(gameData);
      const savedGame = await createdGame.save();

      // Notificar a todos los clientes sobre el nuevo juego
      this.websocketsGateway.emitToAll('game_created', {
        gameId: savedGame._id,
        game: savedGame,
        message: `Nuevo juego "${savedGame.name}" creado`
      });

      return savedGame;
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException('Datos de juego inválidos: ' + error.message);
      }
      throw error;
    }
  }

  async findAll(status?: GameStatus): Promise<Game[]> {
    const query = status ? { status } : {};
    return this.gameModel
      .find(query)
      .populate('clues')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByAdmin(adminId: string): Promise<Game[]> {
    return this.gameModel
      .find({ adminId })
      .populate('clues')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAvailableGames(): Promise<Game[]> {
    return this.gameModel
      .find({
        status: GameStatus.WAITING,
        $expr: { $lt: [{ $size: '$playerIds' }, '$maxPlayers'] }
      })
      .populate('clues')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Game> {
    const game = await this.gameModel
      .findById(id)
      .populate('clues')
      .exec();
    
    if (!game) {
      throw new NotFoundException(`Juego con ID "${id}" no encontrado`);
    }
    
    return game;
  }

  async update(id: string, updateGameDto: UpdateGameDto): Promise<Game> {
    const game = await this.gameModel
      .findByIdAndUpdate(
        id, 
        { 
          ...updateGameDto,
          'metadata.lastActivity': new Date()
        },
        { new: true, runValidators: true }
      )
      .populate('clues')
      .exec();

    if (!game) {
      throw new NotFoundException(`Juego con ID "${id}" no encontrado`);
    }

    // Notificar cambios a los jugadores del juego
    this.websocketsGateway.emitToGame(id, 'game_updated', {
      gameId: id,
      game,
      message: 'Juego actualizado'
    });

    return game;
  }

  async startGame(id: string, adminId: string): Promise<Game> {
    const game = await this.findOne(id);

    if (game.adminId !== adminId) {
      throw new BadRequestException('Solo el administrador puede iniciar el juego');
    }

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('El juego ya ha sido iniciado o completado');
    }

    if (game.clues.length === 0) {
      throw new BadRequestException('No se puede iniciar un juego sin pistas');
    }

    const updatedGame = await this.gameModel
      .findByIdAndUpdate(
        id,
        {
          status: GameStatus.ACTIVE,
          startedAt: new Date(),
          'metadata.lastActivity': new Date()
        },
        { new: true, runValidators: true }
      )
      .populate('clues')
      .exec();

    // Notificar a todos los jugadores que el juego ha iniciado
    this.websocketsGateway.emitToGame(id, 'game_started', {
      gameId: id,
      game: updatedGame,
      message: `¡El juego "${updatedGame.name}" ha comenzado!`
    });

    return updatedGame;
  }

  async joinGame(id: string, joinGameDto: JoinGameDto): Promise<Game> {
    const game = await this.findOne(id);

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('No se puede unir a un juego que ya ha iniciado');
    }

    if (game.playerIds.includes(joinGameDto.playerId)) {
      throw new ConflictException('El jugador ya está en este juego');
    }

    if (game.playerIds.length >= game.maxPlayers) {
      throw new BadRequestException('El juego ha alcanzado el máximo de jugadores');
    }

    const updatedGame = await this.gameModel
      .findByIdAndUpdate(
        id,
        {
          $push: { playerIds: joinGameDto.playerId },
          'metadata.lastActivity': new Date()
        },
        { new: true, runValidators: true }
      )
      .populate('clues')
      .exec();

    // Notificar a todos los jugadores del juego
    this.websocketsGateway.emitToGame(id, 'player_joined', {
      gameId: id,
      playerId: joinGameDto.playerId,
      playerName: joinGameDto.playerName,
      game: updatedGame,
      message: `${joinGameDto.playerName} se ha unido al juego`
    });

    return updatedGame;
  }

  async leaveGame(id: string, playerId: string): Promise<Game> {
    const game = await this.findOne(id);

    if (!game.playerIds.includes(playerId)) {
      throw new BadRequestException('El jugador no está en este juego');
    }

    if (game.adminId === playerId) {
      throw new BadRequestException('El administrador no puede abandonar el juego');
    }

    const updatedGame = await this.gameModel
      .findByIdAndUpdate(
        id,
        {
          $pull: { playerIds: playerId },
          'metadata.lastActivity': new Date()
        },
        { new: true, runValidators: true }
      )
      .populate('clues')
      .exec();

    // Notificar a los jugadores restantes
    this.websocketsGateway.emitToGame(id, 'player_left', {
      gameId: id,
      playerId,
      game: updatedGame,
      message: `Un jugador ha abandonado el juego`
    });

    return updatedGame;
  }

  async remove(id: string, adminId: string): Promise<void> {
    const game = await this.findOne(id);

    if (game.adminId !== adminId) {
      throw new BadRequestException('Solo el administrador puede eliminar el juego');
    }

    await this.gameModel.findByIdAndDelete(id).exec();

    // Notificar que el juego fue eliminado
    this.websocketsGateway.emitToGame(id, 'game_deleted', {
      gameId: id,
      message: 'El juego ha sido eliminado por el administrador'
    });
  }

  async getGameStats(id: string): Promise<any> {
    const game = await this.findOne(id);
    
    return {
      gameId: id,
      totalPlayers: game.playerIds.length,
      maxPlayers: game.maxPlayers,
      totalClues: game.metadata.totalClues,
      completedClues: game.metadata.completedClues,
      progress: game.metadata.totalClues > 0 
        ? (game.metadata.completedClues / game.metadata.totalClues) * 100 
        : 0,
      status: game.status,
      duration: game.startedAt 
        ? Date.now() - game.startedAt.getTime()
        : 0,
      lastActivity: game.metadata.lastActivity
    };
  }

  async updateCluesCount(gameId: string, totalClues: number, completedClues?: number): Promise<void> {
    const updateData: any = {
      'metadata.totalClues': totalClues,
      'metadata.lastActivity': new Date()
    };

    if (completedClues !== undefined) {
      updateData['metadata.completedClues'] = completedClues;
    }

    await this.gameModel.findByIdAndUpdate(gameId, updateData).exec();
  }
}