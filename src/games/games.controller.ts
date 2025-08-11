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
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameStatus } from './schemas/game.schema';
import { DiscoverClueDto } from './dto/discover-clue.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserRole } from 'src/auth/schemas/user.schema';
import { RolesGuard } from 'src/auth/guards/roles.guard';

// DTO para unirse al juego
export class JoinGameDto {
  playerId: string;
  playerName?: string;
}

@Controller('api/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(ValidationPipe) createGameDto: CreateGameDto) {
    console.log(createGameDto)
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
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('status') status?: string,
    @Query('admin') adminId?: string,
  ) {
    try {
      const games = await this.gamesService.findAll();
      
      // Filtrar por adminId si se proporciona
      let filteredGames = games;
      if (adminId) {
        filteredGames = games.filter(game => game.adminId === adminId);
      }

      // Filtrar por status si se proporciona
      if (status) {
        const validStatuses = Object.values(GameStatus);
        if (!validStatuses.includes(status as GameStatus)) {
          throw new BadRequestException(`Status inválido. Valores permitidos: ${validStatuses.join(', ')}`);
        }
        filteredGames = filteredGames.filter(game => game.status === status);
      }

      return {
        success: true,
        message: 'Juegos obtenidos exitosamente',
        data: filteredGames,
        count: filteredGames.length,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener los juegos',
        error: error.message,
      });
    }
  }

  @Get('active')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
     async findActiveGames() {
       try {
         const games = await this.gamesService.findActiveGames();
         return {
           success: true,
           message: 'Juegos activos obtenidos exitosamente',
           data: games,
           count: games.length,
         };
       } catch (error) {
         throw new BadRequestException({
           success: false,
           message: 'Error al obtener juegos activos',
           error: error.message,
         });
       }
     }

  @Get('available')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
  async findAvailable() {
    try {
      const games = await this.gamesService.findAll();
      // Filtrar juegos disponibles (en estado waiting y con espacio)
      const availableGames = games.filter(game => 
        game.status === GameStatus.WAITING && 
        game.playerIds.length < game.maxPlayers
      );

      return {
        success: true,
        message: 'Juegos disponibles obtenidos exitosamente',
        data: availableGames,
        count: availableGames.length,
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
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
  async findOne(@Param('id') id: string) {
    try {
      const game = await this.gamesService.findOne(id);
      return {
        success: true,
        message: 'Juego obtenido exitosamente',
        data: game,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener el juego',
        error: error.message,
      });
    }
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
  async getGameStats(@Param('id') id: string) {
    try {
      const game = await this.gamesService.findOne(id);
      
      // Calcular estadísticas básicas
      const stats = {
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
        lastActivity: game.metadata.lastActivity,
      };

      return {
        success: true,
        message: 'Estadísticas del juego obtenidas exitosamente',
        data: stats,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener estadísticas del juego',
        error: error.message,
      });
    }
  }

  @Patch(':id')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
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
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al actualizar el juego',
        error: error.message,
      });
    }
  }

  @Post(':id/start')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN,UserRole.PLAYER)
  @HttpCode(HttpStatus.OK)
  async startGame(@Param('id') id: string) {
    console.log(id)
    try {
      const game = await this.gamesService.startGame(id);
      return {
        success: true,
        message: 'Juego iniciado exitosamente',
        data: game,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al iniciar el juego',
        error: error.message,
      });
    }
  }

@Post(':id/join')
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(UserRole.PLAYER)
@HttpCode(HttpStatus.OK)
async joinGame(
  @Param('id') id: string,
  @Body(ValidationPipe) joinGameDto: JoinGameDto,
) {
  try {
    const { game, firstClue } = await this.gamesService.joinGame(id, joinGameDto.playerId);
    return {
      success: true,
      message: 'Te has unido al juego exitosamente',
      data: {
        game,
        firstClue,
      },
    };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({
      success: false,
      message: 'Error al unirse al juego',
      error: error.message,
    });
  }
}

  /*
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  async joinGame(
    @Param('id') id: string,
    @Body(ValidationPipe) joinGameDto: JoinGameDto,
  ) {
    try {
      const game = await this.gamesService.joinGame(id, joinGameDto.playerId);
      return {
        success: true,
        message: 'Te has unido al juego exitosamente',
        data: game,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al unirse al juego',
        error: error.message,
      });
    }
  }
*/

  @Post(':id/leave')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.PLAYER)
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
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al abandonar el juego',
        error: error.message,
      });
    }
  }

  @Delete(':id')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    try {
      await this.gamesService.remove(id);
      return {
        success: true,
        message: 'Juego eliminado exitosamente',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al eliminar el juego',
        error: error.message,
      });
    }
  }

  @Get(':id/players')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
  async getGamePlayers(@Param('id') id: string) {
    try {
      const game = await this.gamesService.findOne(id);
      
      const playersInfo = game.playerIds.map(playerId => ({
        id: playerId,
        name: playerId, // Por ahora usamos el ID como nombre, puedes mejorarlo
        isAdmin: playerId === game.adminId,
        joinedAt: game.createdAt || new Date(),
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
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener jugadores del juego',
        error: error.message,
      });
    }
  }

  // ✅ NUEVO: Endpoint para obtener las pistas de un juego
  @Get(':id/clues')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
  async getGameClues(@Param('id') id: string) {
    try {
      console.log(id)
      const game = await this.gamesService.findOne(id);
      
      return {
        success: true,
        message: 'Pistas del juego obtenidas exitosamente',
        data: {
          gameId: id,
          gameName: game.name,
          totalClues: game.clues.length,
          clues: game.clues,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener las pistas del juego',
        error: error.message,
      });
    }
  }

  // ✅ NUEVO: Endpoint para finalizar un juego
  @Post(':id/finish')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async finishGame(@Param('id') id: string) {
    try {
      const game = await this.gamesService.findOne(id);
      
      if (game.status !== GameStatus.ACTIVE) {
        throw new BadRequestException('Solo se pueden finalizar juegos activos');
      }

      // Actualizar el estado del juego
      const updatedGame = await this.gamesService.update(id, {
        status: GameStatus.COMPLETED,
        finishedAt: new Date(),
      });

      return {
        success: true,
        message: 'Juego finalizado exitosamente',
        data: updatedGame,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al finalizar el juego',
        error: error.message,
      });
    }
  }

  // ✅ NUEVO: Endpoint para cancelar un juego
  @Post(':id/cancel')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cancelGame(@Param('id') id: string) {
    try {
      const game = await this.gamesService.findOne(id);
      
      if (game.status === GameStatus.COMPLETED) {
        throw new BadRequestException('No se puede cancelar un juego completado');
      }

      // Actualizar el estado del juego
      const updatedGame = await this.gamesService.update(id, {
        status: GameStatus.CANCELLED,
      });

      return {
        success: true,
        message: 'Juego cancelado exitosamente',
        data: updatedGame,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al cancelar el juego',
        error: error.message,
      });
    }
  }

   

 // DELETE /api/games/:id/clues/:clueId: Elimina una pista específica de un juego
  @Delete(':id/clues/:clueId')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
@HttpCode(HttpStatus.OK)
async removeClueFromGame(
  @Param('id') gameId: string,
  @Param('clueId') clueId: string,
) {
  try {
    const result = await this.gamesService.removeClueFromGame(gameId, clueId);
    return {
      success: true,
      message: 'Pista eliminada del juego exitosamente',
      data: result,
    };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({
      success: false,
      message: 'Error al eliminar la pista del juego',
      error: error.message,
    });
  }
}

@Get('player/:playerId')
 @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
  async getPlayerGames(@Param('playerId') playerId: string) {
    try {
      console.log("llego aqui")
      const games = await this.gamesService.getPlayerGames(playerId);
      return  games
           
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener los juegos del jugador',
        error: error.message,
      });
    }
  }

  @Post('clues/discover')
   @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.PLAYER)
@HttpCode(HttpStatus.OK)
async discoverClue(
  @Body(ValidationPipe) discoverClueDto: DiscoverClueDto,
) {
  
  try {
    console.log('descubriendo pista')
    const result = await this.gamesService.discoverClue(
      discoverClueDto.clueId, 
      discoverClueDto.playerId,
      discoverClueDto.latitude,
      discoverClueDto.longitude
    );
    return {
      success: true,
      message: 'Pista descubierta exitosamente',
      data: result,
    };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({
      success: false,
      message: 'Error al descubrir la pista',
      error: error.message,
    });
  }
}

@Get(':gameId/clues/:clueId/collaborative-status')
 @UseGuards(JwtAuthGuard,RolesGuard)
 @Roles(UserRole.PLAYER)
async getCollaborativeStatus(
  @Param('gameId') gameId: string,
  @Param('clueId') clueId: string,
) {
  try {
    const status = await this.gamesService.getCollaborativeStatus(clueId, gameId);
    return {
      success: true,
      message: 'Estado de pista colaborativa obtenido exitosamente',
      data: status,
    };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({
      success: false,
      message: 'Error al obtener estado de pista colaborativa',
      error: error.message,
    });
  }
}

/**
 * Obtiene la cantidad de juegos ganados y detalles de victorias de un jugador
 * GET /api/games/player/:playerId/wins
 */
@Get('player/:playerId/wins')
 @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
async getPlayerWins(@Param('playerId') playerId: string) {
  try {
    const wins = await this.gamesService.getPlayerWins(playerId);
    return wins;
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({
      success: false,
      message: 'Error al obtener victorias del jugador',
      error: error.message,
    });
  }
}

@Get(':id/collaborative-clues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async getGameCollaborativeClues(@Param('id') id: string) {
  try {
    const result = await this.gamesService.findCollaborativeClues(id);
    return {
      success: true,
      message: 'Pistas colaborativas obtenidas exitosamente',
      data: result,
    };
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw error;
    }
    throw new BadRequestException({
      success: false,
      message: 'Error al obtener las pistas colaborativas del juego',
      error: error.message,
    });
  }
}

/**
 * GET /api/games/player/:playerId/achievements/stats
 * Obtiene estadísticas generales de achievements de un jugador
 */
@Get('player/:playerId/achievements/stats')
@UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PLAYER)
async getPlayerAchievementStats(@Param('playerId') playerId: string) {
  try {
    const stats = await this.gamesService.getPlayerAchievementStats(playerId);
    return {
      success: true,
      message: 'Estadísticas de achievements obtenidas exitosamente',
      data: stats.data,
    };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({
      success: false,
      message: 'Error al obtener estadísticas de achievements',
      error: error.message,
    });
  }
}



}