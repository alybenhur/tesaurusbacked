import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto, UpdateGameDto, JoinGameDto } from './dto/create-game.dto';
import { GameStatus } from './schemas/game.schema';

@Controller('api/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(ValidationPipe) createGameDto: CreateGameDto) {
    try {
      const game = await this.gamesService.create(createGameDto);
      return {
        success: true,
        message: 'Juego creado exitosamente',
        data: game,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al crear el juego',
        error: error.message,
      });
    }
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('admin') adminId?: string,
  ) {
    try {
      let games;

      if (adminId) {
        games = await this.gamesService.findByAdmin(adminId);
      } else if (status) {
        const validStatuses = Object.values(GameStatus);
        if (!validStatuses.includes(status as GameStatus)) {
          throw new BadRequestException(`Status inválido. Valores permitidos: ${validStatuses.join(', ')}`);
        }
        games = await this.gamesService.findAll(status as GameStatus);
      } else {
        games = await this.gamesService.findAll();
      }

      return {
        success: true,
        message: 'Juegos obtenidos exitosamente',
        data: games,
        count: games.length,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener los juegos',
        error: error.message,
      });
    }
  }

  @Get('available')
  async findAvailable() {
    try {
      const games = await this.gamesService.findAvailableGames();
      return {
        success: true,
        message: 'Juegos disponibles obtenidos exitosamente',
        data: games,
        count: games.length,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener juegos disponibles',
        error: error.message,
      });
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const game = await this.gamesService.findOne(id);
      return {
        success: true,
        message: 'Juego obtenido exitosamente',
        data: game,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener el juego',
        error: error.message,
      });
    }
  }

  @Get(':id/stats')
  async getGameStats(@Param('id') id: string) {
    try {
      const stats = await this.gamesService.getGameStats(id);
      return {
        success: true,
        message: 'Estadísticas del juego obtenidas exitosamente',
        data: stats,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener estadísticas del juego',
        error: error.message,
      });
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateGameDto: UpdateGameDto,
  ) {
    try {
      const game = await this.gamesService.update(id, updateGameDto);
      return {
        success: true,
        message: 'Juego actualizado exitosamente',
        data: game,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al actualizar el juego',
        error: error.message,
      });
    }
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startGame(
    @Param('id') id: string,
    @Body() body: { adminId: string },
  ) {
    try {
      if (!body.adminId) {
        throw new BadRequestException('adminId es requerido');
      }

      const game = await this.gamesService.startGame(id, body.adminId);
      return {
        success: true,
        message: 'Juego iniciado exitosamente',
        data: game,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al iniciar el juego',
        error: error.message,
      });
    }
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  async joinGame(
    @Param('id') id: string,
    @Body(ValidationPipe) joinGameDto: JoinGameDto,
  ) {
    try {
      const game = await this.gamesService.joinGame(id, joinGameDto);
      return {
        success: true,
        message: 'Te has unido al juego exitosamente',
        data: game,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al unirse al juego',
        error: error.message,
      });
    }
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  async leaveGame(
    @Param('id') id: string,
    @Body() body: { playerId: string },
  ) {
    try {
      if (!body.playerId) {
        throw new BadRequestException('playerId es requerido');
      }

      const game = await this.gamesService.leaveGame(id, body.playerId);
      return {
        success: true,
        message: 'Has abandonado el juego exitosamente',
        data: game,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al abandonar el juego',
        error: error.message,
      });
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Query('adminId') adminId: string,
  ) {
    try {
      if (!adminId) {
        throw new BadRequestException('adminId es requerido como query parameter');
      }

      await this.gamesService.remove(id, adminId);
      return {
        success: true,
        message: 'Juego eliminado exitosamente',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al eliminar el juego',
        error: error.message,
      });
    }
  }

  @Get(':id/players')
async getGamePlayers(@Param('id') id: string) {
  try {
    const game = await this.gamesService.findOne(id);
    
    const playersInfo = game.playerIds.map(playerId => ({
      id: playerId,
      isAdmin: playerId === game.adminId,
      joinedAt: (game as any).createdAt || new Date(), // Cast temporal
    }));

    return {
      success: true,
      message: 'Jugadores del juego obtenidos exitosamente',
      data: {
        gameId: id,
        gameName: game.name,
        totalPlayers: playersInfo.length,
        maxPlayers: game.maxPlayers,
        players: playersInfo,
      },
    };
  } catch (error) {
    throw new BadRequestException({
      success: false,
      message: 'Error al obtener jugadores del juego',
      error: error.message,
    });
  }
}
}