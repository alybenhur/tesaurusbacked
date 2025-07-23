"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesController = exports.JoinGameDto = void 0;
const common_1 = require("@nestjs/common");
const games_service_1 = require("./games.service");
const create_game_dto_1 = require("./dto/create-game.dto");
const update_game_dto_1 = require("./dto/update-game.dto");
const game_schema_1 = require("./schemas/game.schema");
const discover_clue_dto_1 = require("./dto/discover-clue.dto");
class JoinGameDto {
}
exports.JoinGameDto = JoinGameDto;
let GamesController = class GamesController {
    constructor(gamesService) {
        this.gamesService = gamesService;
    }
    async create(createGameDto) {
        console.log(createGameDto);
        try {
            const game = await this.gamesService.create(createGameDto);
            return {
                success: true,
                message: 'Juego creado exitosamente',
                data: game,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al crear el juego',
                error: error.message,
            });
        }
    }
    async findAll(status, adminId) {
        try {
            const games = await this.gamesService.findAll();
            let filteredGames = games;
            if (adminId) {
                filteredGames = games.filter(game => game.adminId === adminId);
            }
            if (status) {
                const validStatuses = Object.values(game_schema_1.GameStatus);
                if (!validStatuses.includes(status)) {
                    throw new common_1.BadRequestException(`Status inválido. Valores permitidos: ${validStatuses.join(', ')}`);
                }
                filteredGames = filteredGames.filter(game => game.status === status);
            }
            return {
                success: true,
                message: 'Juegos obtenidos exitosamente',
                data: filteredGames,
                count: filteredGames.length,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener los juegos',
                error: error.message,
            });
        }
    }
    async findActiveGames() {
        try {
            const games = await this.gamesService.findActiveGames();
            return {
                success: true,
                message: 'Juegos activos obtenidos exitosamente',
                data: games,
                count: games.length,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener juegos activos',
                error: error.message,
            });
        }
    }
    async findAvailable() {
        try {
            const games = await this.gamesService.findAll();
            const availableGames = games.filter(game => game.status === game_schema_1.GameStatus.WAITING &&
                game.playerIds.length < game.maxPlayers);
            return {
                success: true,
                message: 'Juegos disponibles obtenidos exitosamente',
                data: availableGames,
                count: availableGames.length,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener juegos disponibles',
                error: error.message,
            });
        }
    }
    async findOne(id) {
        try {
            const game = await this.gamesService.findOne(id);
            return {
                success: true,
                message: 'Juego obtenido exitosamente',
                data: game,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener el juego',
                error: error.message,
            });
        }
    }
    async getGameStats(id) {
        try {
            const game = await this.gamesService.findOne(id);
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
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener estadísticas del juego',
                error: error.message,
            });
        }
    }
    async update(id, updateGameDto) {
        try {
            const game = await this.gamesService.update(id, updateGameDto);
            return {
                success: true,
                message: 'Juego actualizado exitosamente',
                data: game,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al actualizar el juego',
                error: error.message,
            });
        }
    }
    async startGame(id) {
        console.log(id);
        try {
            const game = await this.gamesService.startGame(id);
            return {
                success: true,
                message: 'Juego iniciado exitosamente',
                data: game,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al iniciar el juego',
                error: error.message,
            });
        }
    }
    async joinGame(id, joinGameDto) {
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
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al unirse al juego',
                error: error.message,
            });
        }
    }
    async leaveGame(id, body) {
        try {
            if (!body.playerId) {
                throw new common_1.BadRequestException('playerId es requerido');
            }
            const game = await this.gamesService.leaveGame(id, body.playerId);
            return {
                success: true,
                message: 'Has abandonado el juego exitosamente',
                data: game,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al abandonar el juego',
                error: error.message,
            });
        }
    }
    async remove(id) {
        try {
            await this.gamesService.remove(id);
            return {
                success: true,
                message: 'Juego eliminado exitosamente',
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al eliminar el juego',
                error: error.message,
            });
        }
    }
    async getGamePlayers(id) {
        try {
            const game = await this.gamesService.findOne(id);
            const playersInfo = game.playerIds.map(playerId => ({
                id: playerId,
                name: playerId,
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
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener jugadores del juego',
                error: error.message,
            });
        }
    }
    async getGameClues(id) {
        try {
            console.log(id);
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
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener las pistas del juego',
                error: error.message,
            });
        }
    }
    async finishGame(id) {
        try {
            const game = await this.gamesService.findOne(id);
            if (game.status !== game_schema_1.GameStatus.ACTIVE) {
                throw new common_1.BadRequestException('Solo se pueden finalizar juegos activos');
            }
            const updatedGame = await this.gamesService.update(id, {
                status: game_schema_1.GameStatus.COMPLETED,
                finishedAt: new Date(),
            });
            return {
                success: true,
                message: 'Juego finalizado exitosamente',
                data: updatedGame,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al finalizar el juego',
                error: error.message,
            });
        }
    }
    async cancelGame(id) {
        try {
            const game = await this.gamesService.findOne(id);
            if (game.status === game_schema_1.GameStatus.COMPLETED) {
                throw new common_1.BadRequestException('No se puede cancelar un juego completado');
            }
            const updatedGame = await this.gamesService.update(id, {
                status: game_schema_1.GameStatus.CANCELLED,
            });
            return {
                success: true,
                message: 'Juego cancelado exitosamente',
                data: updatedGame,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al cancelar el juego',
                error: error.message,
            });
        }
    }
    async removeClueFromGame(gameId, clueId) {
        try {
            const result = await this.gamesService.removeClueFromGame(gameId, clueId);
            return {
                success: true,
                message: 'Pista eliminada del juego exitosamente',
                data: result,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al eliminar la pista del juego',
                error: error.message,
            });
        }
    }
    async getPlayerGames(playerId) {
        try {
            console.log("llego aqui");
            const games = await this.gamesService.getPlayerGames(playerId);
            return games;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener los juegos del jugador',
                error: error.message,
            });
        }
    }
    async discoverClue(discoverClueDto) {
        try {
            console.log('descubriendo pista');
            const result = await this.gamesService.discoverClue(discoverClueDto.clueId, discoverClueDto.playerId, discoverClueDto.latitude, discoverClueDto.longitude);
            return {
                success: true,
                message: 'Pista descubierta exitosamente',
                data: result,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al descubrir la pista',
                error: error.message,
            });
        }
    }
    async getCollaborativeStatus(gameId, clueId) {
        try {
            const status = await this.gamesService.getCollaborativeStatus(clueId, gameId);
            return {
                success: true,
                message: 'Estado de pista colaborativa obtenido exitosamente',
                data: status,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener estado de pista colaborativa',
                error: error.message,
            });
        }
    }
    async getPlayerWins(playerId) {
        try {
            const wins = await this.gamesService.getPlayerWins(playerId);
            return wins;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener victorias del jugador',
                error: error.message,
            });
        }
    }
    async getPlayerAchievementStats(playerId) {
        try {
            const stats = await this.gamesService.getPlayerAchievementStats(playerId);
            return {
                success: true,
                message: 'Estadísticas de achievements obtenidas exitosamente',
                data: stats.data,
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException({
                success: false,
                message: 'Error al obtener estadísticas de achievements',
                error: error.message,
            });
        }
    }
};
exports.GamesController = GamesController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_game_dto_1.CreateGameDto]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('admin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "findActiveGames", null);
__decorate([
    (0, common_1.Get)('available'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "findAvailable", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/stats'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getGameStats", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_game_dto_1.UpdateGameDto]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "startGame", null);
__decorate([
    (0, common_1.Post)(':id/join'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, JoinGameDto]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "joinGame", null);
__decorate([
    (0, common_1.Post)(':id/leave'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "leaveGame", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/players'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getGamePlayers", null);
__decorate([
    (0, common_1.Get)(':id/clues'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getGameClues", null);
__decorate([
    (0, common_1.Post)(':id/finish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "finishGame", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "cancelGame", null);
__decorate([
    (0, common_1.Delete)(':id/clues/:clueId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('clueId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "removeClueFromGame", null);
__decorate([
    (0, common_1.Get)('player/:playerId'),
    __param(0, (0, common_1.Param)('playerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getPlayerGames", null);
__decorate([
    (0, common_1.Post)('clues/discover'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [discover_clue_dto_1.DiscoverClueDto]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "discoverClue", null);
__decorate([
    (0, common_1.Get)(':gameId/clues/:clueId/collaborative-status'),
    __param(0, (0, common_1.Param)('gameId')),
    __param(1, (0, common_1.Param)('clueId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getCollaborativeStatus", null);
__decorate([
    (0, common_1.Get)('player/:playerId/wins'),
    __param(0, (0, common_1.Param)('playerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getPlayerWins", null);
__decorate([
    (0, common_1.Get)('player/:playerId/achievements/stats'),
    __param(0, (0, common_1.Param)('playerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getPlayerAchievementStats", null);
exports.GamesController = GamesController = __decorate([
    (0, common_1.Controller)('api/games'),
    __metadata("design:paramtypes", [games_service_1.GamesService])
], GamesController);
//# sourceMappingURL=games.controller.js.map