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
exports.GamesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const game_schema_1 = require("./schemas/game.schema");
const clue_schema_1 = require("../clues/schemas/clue.schema");
const player_progress_schema_1 = require("./schemas/player-progress.schema");
const collaborative_attempt_schema_1 = require("./schemas/collaborative-attempt.schema");
const player_achievement_schema_1 = require("./schemas/player-achievement.schema");
let GamesService = class GamesService {
    constructor(gameModel, clueModel, playerProgressModel, collaborativeAttemptModel, playerAchievementModel) {
        this.gameModel = gameModel;
        this.clueModel = clueModel;
        this.playerProgressModel = playerProgressModel;
        this.collaborativeAttemptModel = collaborativeAttemptModel;
        this.playerAchievementModel = playerAchievementModel;
    }
    async create(createGameDto) {
        try {
            const gameData = {
                name: createGameDto.name,
                description: createGameDto.description,
                adminId: createGameDto.adminId,
                maxPlayers: createGameDto.maxPlayers,
                revealDelayMs: createGameDto.revealDelayMs,
                status: 'waiting',
                playerIds: [createGameDto.adminId],
                clues: [],
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
            if (createGameDto.clues && createGameDto.clues.length > 0) {
                const clueIds = await this.createCluesForGame(savedGame._id.toString(), createGameDto.clues);
                savedGame.clues = clueIds;
                savedGame.metadata.totalClues = clueIds.length;
                const gameArea = await this.calculateGameArea(clueIds);
                if (gameArea) {
                    savedGame.gameArea = gameArea;
                }
                await savedGame.save();
            }
            return savedGame;
        }
        catch (error) {
            throw new common_1.BadRequestException(`Error creating game: ${error.message}`);
        }
    }
    async findActiveGames() {
        return this.gameModel.find({ status: game_schema_1.GameStatus.ACTIVE }).populate('clues').exec();
    }
    async createCluesForGame(gameId, cluesDto) {
        const cluePromises = cluesDto.map(async (clueDto, index) => {
            const clueData = {
                ...clueDto,
                gameId: new mongoose_2.Types.ObjectId(gameId),
                order: clueDto.order || index,
                status: 'hidden',
                idPista: clueDto.idPista,
                range: clueDto.range,
                ...(clueDto.latitude && clueDto.longitude && {
                    location: {
                        latitude: clueDto.latitude,
                        longitude: clueDto.longitude
                    }
                })
            };
            const clue = new this.clueModel(clueData);
            const savedClue = await clue.save();
            return savedClue._id;
        });
        return Promise.all(cluePromises);
    }
    async removeClueFromGame(gameId, clueId) {
        try {
            const game = await this.gameModel.findById(gameId).populate('clues').exec();
            if (!game) {
                throw new common_1.NotFoundException(`Game with ID ${gameId} not found`);
            }
            if (game.status === game_schema_1.GameStatus.ACTIVE) {
                throw new common_1.BadRequestException('Cannot remove clues from an active game');
            }
            const clue = await this.clueModel.findById(clueId).exec();
            if (!clue) {
                throw new common_1.NotFoundException(`Clue with ID ${clueId} not found`);
            }
            if (clue.gameId.toString() !== gameId) {
                throw new common_1.BadRequestException('Clue does not belong to this game');
            }
            await this.clueModel.deleteOne({ _id: clueId }).exec();
            game.clues = game.clues.filter(clueObjectId => clueObjectId.toString() !== clueId);
            game.metadata.totalClues = game.clues.length;
            game.metadata.lastActivity = new Date();
            if (game.clues.length > 0) {
                const gameArea = await this.calculateGameArea(game.clues);
                if (gameArea) {
                    game.gameArea = gameArea;
                }
            }
            else {
                game.gameArea = {
                    center: { latitude: 0, longitude: 0 },
                    bounds: {
                        northEast: { latitude: 0, longitude: 0 },
                        southWest: { latitude: 0, longitude: 0 }
                    }
                };
            }
            await game.save();
            return this.gameModel.findById(gameId).populate('clues').exec();
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Error removing clue from game: ${error.message}`);
        }
    }
    async calculateGameArea(clueIds) {
        const clues = await this.clueModel.find({
            _id: { $in: clueIds },
            location: { $exists: true }
        }).exec();
        if (clues.length === 0)
            return null;
        const locations = clues
            .filter(clue => clue.location)
            .map(clue => clue.location);
        if (locations.length === 0)
            return null;
        const latitudes = locations.map(loc => loc.latitude);
        const longitudes = locations.map(loc => loc.longitude);
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLng = Math.min(...longitudes);
        const maxLng = Math.max(...longitudes);
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
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
    async findAll() {
        return this.gameModel.find().populate('clues').exec();
    }
    async findOne(id) {
        const game = await this.gameModel.findById(id).populate('clues').exec();
        if (!game) {
            throw new common_1.NotFoundException(`Game with ID ${id} not found`);
        }
        return game;
    }
    async update(id, updateGameDto) {
        const updatedGame = await this.gameModel
            .findByIdAndUpdate(id, updateGameDto, { new: true })
            .populate('clues')
            .exec();
        if (!updatedGame) {
            throw new common_1.NotFoundException(`Game with ID ${id} not found`);
        }
        return updatedGame;
    }
    async remove(id) {
        await this.clueModel.deleteMany({ gameId: id }).exec();
        const result = await this.gameModel.deleteOne({ _id: id }).exec();
        if (result.deletedCount === 0) {
            throw new common_1.NotFoundException(`Game with ID ${id} not found`);
        }
    }
    async joinGame(gameId, playerId) {
        if (!mongoose_2.Types.ObjectId.isValid(gameId)) {
            throw new common_1.BadRequestException(`ID de juego inválido: ${gameId}`);
        }
        const game = await this.gameModel.findById(gameId).populate({
            path: 'clues',
            model: 'Clue',
        }).exec();
        if (!game) {
            throw new common_1.NotFoundException(`Juego con ID ${gameId} no encontrado`);
        }
        if (game.playerIds.includes(playerId)) {
            throw new common_1.BadRequestException('El jugador ya está inscrito en este juego');
        }
        if (game.playerIds.length >= game.maxPlayers) {
            throw new common_1.BadRequestException('El juego está lleno');
        }
        game.playerIds.push(playerId);
        game.metadata.lastActivity = new Date();
        await game.save();
        let playerProgress = await this.playerProgressModel.findOne({ gameId, playerId }).exec();
        if (!playerProgress) {
            playerProgress = new this.playerProgressModel({
                gameId: new mongoose_2.Types.ObjectId(gameId),
                playerId,
                clues: [],
                totalPoints: 0,
                lastActivity: new Date(),
            });
        }
        console.log(`Contenido de game.clues: ${JSON.stringify(game.clues, null, 2)}`);
        console.log(`Número de pistas en game.clues: ${game.clues.length}`);
        const clueIds = game.clues.map((clue) => clue._id?.toString() || clue.toString());
        console.log(`IDs de pistas en game.clues: ${JSON.stringify(clueIds, null, 2)}`);
        const firstClue = await this.clueModel.findOne({
            gameId: new mongoose_2.Types.ObjectId(gameId),
            order: 0
        }).exec();
        if (!firstClue) {
            console.warn(`No se encontró ninguna pista con order: 0 para el juego ${gameId}`);
            console.log(`Consulta ejecutada: gameId: ${new mongoose_2.Types.ObjectId(gameId)}, order: 0`);
            const allClues = await this.clueModel.find({ gameId: new mongoose_2.Types.ObjectId(gameId) }).exec();
            console.log(`Todas las pistas del juego ${gameId}: ${JSON.stringify(allClues.map(clue => ({
                _id: clue._id,
                order: clue.order,
                title: clue.title
            })), null, 2)}`);
        }
        else {
            console.log(`Primera pista encontrada: ${JSON.stringify({
                _id: firstClue._id,
                order: firstClue.order,
                status: firstClue.status,
                title: firstClue.title
            }, null, 2)}`);
        }
        if (firstClue) {
            const clueProgress = {
                clueId: firstClue._id,
                status: clue_schema_1.ClueStatus.DISCOVERED,
                discoveredAt: new Date(),
            };
            const clueExists = playerProgress.clues.some(clue => clue.clueId.toString() === firstClue._id.toString());
            if (!clueExists) {
                playerProgress.clues.push(clueProgress);
                console.log(`Pista ${firstClue._id} añadida al progreso del jugador ${playerId}`);
            }
            else {
                console.log(`Pista ${firstClue._id} ya estaba en el progreso del jugador ${playerId}`);
            }
            firstClue.discoveredBy = new mongoose_2.Types.ObjectId(playerId);
            firstClue.discoveredAt = new Date();
            firstClue.status = clue_schema_1.ClueStatus.DISCOVERED;
            await firstClue.save();
            game.metadata.completedClues = await this.clueModel.countDocuments({
                gameId: new mongoose_2.Types.ObjectId(gameId),
                status: clue_schema_1.ClueStatus.DISCOVERED,
            }).exec();
            game.metadata.lastActivity = new Date();
            await game.save();
        }
        const savedPlayerProgress = await playerProgress.save();
        if (firstClue && !savedPlayerProgress.clues.find(clue => clue.clueId.toString() === firstClue._id.toString())) {
            console.error(`Error: La pista ${firstClue._id} no se almacenó en PlayerProgress para el jugador ${playerId}`);
            console.log(`Contenido de savedPlayerProgress.clues: ${JSON.stringify(savedPlayerProgress.clues, null, 2)}`);
        }
        return {
            game,
            firstClue,
        };
    }
    async leaveGame(gameId, playerId) {
        const game = await this.gameModel.findById(gameId).exec();
        if (!game) {
            throw new common_1.NotFoundException(`Game with ID ${gameId} not found`);
        }
        game.playerIds = game.playerIds.filter(id => id !== playerId);
        game.metadata.lastActivity = new Date();
        return game.save();
    }
    async startGame(gameId) {
        const game = await this.gameModel.findById(gameId).exec();
        if (!game) {
            throw new common_1.NotFoundException(`Game with ID ${gameId} not found`);
        }
        if (game.status !== 'waiting') {
            throw new common_1.BadRequestException('Game cannot be started');
        }
        game.status = game_schema_1.GameStatus.ACTIVE;
        game.startedAt = new Date();
        game.metadata.lastActivity = new Date();
        return game.save();
    }
    async getPlayerGames(playerId) {
        console.log("ejecucion");
        try {
            const playerProgresses = await this.playerProgressModel
                .find({ playerId })
                .populate({
                path: 'gameId',
                model: 'Game',
                select: 'name description status createdAt updatedAt metadata playerIds adminId maxPlayers clues',
            })
                .populate({
                path: 'clues.clueId',
                model: 'Clue',
                select: 'title description order status discoveredAt discoveredBy gameId idPista type',
            })
                .exec();
            const games = playerProgresses.map(progress => {
                const game = progress.gameId;
                const discoveredClues = progress.clues
                    .filter(clue => clue.status === clue_schema_1.ClueStatus.DISCOVERED)
                    .map(clue => ({
                    clueId: clue.clueId._id.toString(),
                    title: clue.clueId.title,
                    description: clue.clueId.description,
                    order: clue.clueId.order,
                    status: clue.status,
                    discoveredAt: clue.discoveredAt ? clue.discoveredAt.toISOString() : null,
                    discoveredBy: clue.clueId.discoveredBy,
                    gameId: clue.clueId.gameId,
                    idPista: clue.clueId.idPista || `UNKNOWN_${clue.clueId._id}`,
                    type: clue.clueId.type || 'text',
                }));
                return {
                    gameId: game._id.toString(),
                    name: game.name,
                    description: game.description,
                    status: game.status,
                    createdAt: game.createdAt.toISOString(),
                    updatedAt: game.updatedAt.toISOString(),
                    totalClues: game.metadata?.totalClues || 0,
                    completedClues: game.metadata?.completedClues || 0,
                    discoveredClues,
                    discoveredCluesCount: discoveredClues.length,
                    playerIds: game.playerIds || [],
                    adminId: game.adminId || '',
                    maxPlayers: game.maxPlayers || 0,
                    clues: game.clues || [],
                };
            });
            return {
                success: true,
                message: 'Juegos del jugador obtenidos exitosamente',
                data: games,
                count: games.length,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Error al obtener los juegos del jugador: ${error.message}`);
        }
    }
    async discoverClue(clueId, playerId, playerLatitude, playerLongitude) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(clueId)) {
                throw new common_1.BadRequestException(`ID de pista inválido: ${clueId}`);
            }
            if (playerLatitude < -90 || playerLatitude > 90) {
                throw new common_1.BadRequestException('Latitud del jugador inválida (debe estar entre -90 y 90)');
            }
            if (playerLongitude < -180 || playerLongitude > 180) {
                throw new common_1.BadRequestException('Longitud del jugador inválida (debe estar entre -180 y 180)');
            }
            const clue = await this.clueModel.findById(clueId).exec();
            if (!clue) {
                throw new common_1.NotFoundException(`Pista con ID ${clueId} no encontrada`);
            }
            this.validateProximity(clue, playerLatitude, playerLongitude);
            const game = await this.gameModel.findById(clue.gameId).populate('clues').exec();
            if (!game) {
                throw new common_1.NotFoundException(`Juego asociado a la pista no encontrado`);
            }
            if (!game.playerIds.includes(playerId)) {
                throw new common_1.BadRequestException('El jugador no está suscrito a este juego');
            }
            if (game.status !== game_schema_1.GameStatus.ACTIVE) {
                throw new common_1.BadRequestException('Solo se pueden descubrir pistas en juegos activos');
            }
            const distance = this.calculateDistance(playerLatitude, playerLongitude, clue.location.latitude, clue.location.longitude);
            const proximityInfo = {
                distance,
                range: clue.range,
                isWithinRange: distance <= clue.range
            };
            if (clue.isCollaborative) {
                const result = await this.handleCollaborativeClue(clue, playerId, game);
                return {
                    ...result,
                    proximityInfo
                };
            }
            const result = await this.handleNormalClue(clue, playerId, game);
            return {
                ...result,
                proximityInfo
            };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Error al descubrir la pista: ${error.message}`);
        }
    }
    async handleCollaborativeClue(clue, playerId, game) {
        await this.validateClueOrder(clue, playerId, game);
        await this.expireOldCollaborativeAttempts();
        let collaborativeAttempt = await this.findOrCreateCollaborativeAttempt(clue, playerId);
        collaborativeAttempt = await this.addPlayerToCollaborativeAttempt(collaborativeAttempt, playerId);
        const isCompleted = collaborativeAttempt.participantIds.length >= collaborativeAttempt.requiredPlayers;
        if (isCompleted && collaborativeAttempt.status === collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE) {
            await this.completeCollaborativeAttempt(collaborativeAttempt, clue, game);
        }
        const now = new Date();
        const timeRemaining = Math.max(0, collaborativeAttempt.expiresAt.getTime() - now.getTime());
        const playerProgress = await this.playerProgressModel.findOne({
            gameId: clue.gameId,
            playerId: playerId
        }).exec();
        if (!playerProgress) {
            throw new common_1.NotFoundException('Progreso del jugador no encontrado');
        }
        const nextClue = await this.clueModel.findOne({
            gameId: clue.gameId,
            order: clue.order + 1
        }).exec();
        const allGameClues = await this.clueModel.find({
            gameId: clue.gameId
        }).sort({ order: 1 }).exec();
        const totalGameClues = allGameClues.length;
        const playerDiscoveredCount = playerProgress.clues.filter(pc => pc.status === clue_schema_1.ClueStatus.DISCOVERED).length;
        const isGameCompleted = playerDiscoveredCount === totalGameClues;
        if (isGameCompleted) {
            game.status = game_schema_1.GameStatus.COMPLETED;
            game.finishedAt = new Date();
            await game.save();
            await this.processGameCompletionAchievements(game._id);
        }
        const gameProgress = {
            totalClues: totalGameClues,
            discoveredClues: playerDiscoveredCount,
            progress: totalGameClues > 0 ? (playerDiscoveredCount / totalGameClues) * 100 : 0,
            hasMoreClues: nextClue !== null,
        };
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
    async handleNormalClue(clue, playerId, game) {
        await this.validateClueOrder(clue, playerId, game);
        let playerProgress = await this.playerProgressModel.findOne({
            gameId: clue.gameId,
            playerId: playerId
        }).exec();
        if (!playerProgress) {
            throw new common_1.NotFoundException('Progreso del jugador no encontrado');
        }
        const alreadyDiscovered = playerProgress.clues.some(progressClue => progressClue.clueId.toString() === clue._id.toString() &&
            progressClue.status === clue_schema_1.ClueStatus.DISCOVERED);
        if (alreadyDiscovered) {
            throw new common_1.BadRequestException('El jugador ya ha descubierto esta pista');
        }
        const freshGame = await this.gameModel.findById(game._id).exec();
        if (!freshGame) {
            throw new common_1.NotFoundException('Juego no encontrado');
        }
        if (freshGame.status !== game_schema_1.GameStatus.ACTIVE) {
            throw new common_1.BadRequestException('El juego ya fue completado por otro jugador');
        }
        clue.discoveredBy = new mongoose_2.Types.ObjectId(playerId);
        clue.discoveredAt = new Date();
        clue.status = clue_schema_1.ClueStatus.DISCOVERED;
        await clue.save();
        const clueProgressIndex = playerProgress.clues.findIndex(pc => pc.clueId.toString() === clue._id.toString());
        if (clueProgressIndex >= 0) {
            playerProgress.clues[clueProgressIndex].status = clue_schema_1.ClueStatus.DISCOVERED;
            playerProgress.clues[clueProgressIndex].discoveredAt = new Date();
        }
        else {
            playerProgress.clues.push({
                clueId: new mongoose_2.Types.ObjectId(clue._id.toString()),
                status: clue_schema_1.ClueStatus.DISCOVERED,
                discoveredAt: new Date(),
            });
        }
        playerProgress.lastActivity = new Date();
        await playerProgress.save();
        const allGameClues = await this.clueModel.find({
            gameId: clue.gameId
        }).sort({ order: 1 }).exec();
        const totalGameClues = allGameClues.length;
        const playerDiscoveredCount = playerProgress.clues.filter(pc => pc.status === clue_schema_1.ClueStatus.DISCOVERED).length;
        const isGameCompleted = playerDiscoveredCount === totalGameClues;
        let isWinner = false;
        let gameStatusMessage = '';
        if (isGameCompleted) {
            const atomicWinResult = await this.attemptToWinGame(freshGame._id.toString(), playerId);
            if (atomicWinResult.isWinner) {
                isWinner = true;
                gameStatusMessage = '🏆 ¡Felicitaciones! Has ganado el juego al completar todas las pistas.';
                await this.processPlayerCompletionAchievements(playerId, freshGame._id);
            }
            else {
                gameStatusMessage = `Has completado todas las pistas, pero ${atomicWinResult.winnerId || 'otro jugador'} ya ganó el juego.`;
                await this.processPlayerParticipationAchievements(playerId, freshGame._id);
            }
        }
        const totalDiscoveredClues = await this.clueModel.countDocuments({
            gameId: clue.gameId,
            status: clue_schema_1.ClueStatus.DISCOVERED
        }).exec();
        freshGame.metadata.completedClues = totalDiscoveredClues;
        freshGame.metadata.lastActivity = new Date();
        await freshGame.save();
        const nextClue = await this.clueModel.findOne({
            gameId: clue.gameId,
            order: clue.order + 1
        }).exec();
        const gameProgress = {
            totalClues: totalGameClues,
            discoveredClues: playerDiscoveredCount,
            progress: totalGameClues > 0 ? (playerDiscoveredCount / totalGameClues) * 100 : 0,
            hasMoreClues: nextClue !== null,
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
    async attemptToWinGame(gameId, playerId) {
        try {
            const updateResult = await this.gameModel.findOneAndUpdate({
                _id: gameId,
                status: game_schema_1.GameStatus.ACTIVE
            }, {
                status: game_schema_1.GameStatus.COMPLETED,
                finishedAt: new Date(),
                winnerId: playerId
            }, { new: true }).exec();
            if (updateResult) {
                console.log(`🏆 ¡${playerId} ganó el juego ${updateResult.name}!`);
                return {
                    isWinner: true,
                    winnerId: playerId
                };
            }
            else {
                const completedGame = await this.gameModel.findById(gameId).exec();
                console.log(`⏱️ ${playerId} completó todas las pistas, pero ${completedGame?.winnerId || 'otro jugador'} ya ganó`);
                return {
                    isWinner: false,
                    winnerId: completedGame?.winnerId || null
                };
            }
        }
        catch (error) {
            console.error('Error en attemptToWinGame:', error);
            return {
                isWinner: false,
                winnerId: null
            };
        }
    }
    async processPlayerCompletionAchievements(playerId, gameId) {
        try {
            const game = await this.gameModel.findById(gameId).exec();
            if (!game)
                return;
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
            if (!playerProgress)
                return;
            const playerStats = await this.calculatePlayerStats(playerId, gameId, playerProgress, 0);
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
            await this.createAchievementRecord(playerId, gameId, player_achievement_schema_1.AchievementType.GAME_WIN, baseGameDetails);
            await this.createAchievementRecord(playerId, gameId, player_achievement_schema_1.AchievementType.GAME_PARTICIPATION, baseGameDetails);
            console.log(`🏆 Achievements WIN + PARTICIPATION creados para ganador ${playerId}`);
        }
        catch (error) {
            console.error(`Error procesando achievements de ganador para ${playerId}:`, error);
        }
    }
    async processPlayerParticipationAchievements(playerId, gameId) {
        try {
            const game = await this.gameModel.findById(gameId).exec();
            if (!game)
                return;
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
            if (!playerProgress)
                return;
            const playerStats = await this.calculatePlayerStats(playerId, gameId, playerProgress, 0);
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
            await this.createAchievementRecord(playerId, gameId, player_achievement_schema_1.AchievementType.GAME_PARTICIPATION, baseGameDetails);
            console.log(`🎖️ Achievement PARTICIPATION creado para jugador ${playerId}`);
        }
        catch (error) {
            console.error(`Error procesando participation achievement para ${playerId}:`, error);
        }
    }
    async validateClueOrder(clue, playerId, game) {
        const playerProgress = await this.playerProgressModel.findOne({
            gameId: clue.gameId,
            playerId: playerId
        }).exec();
        if (!playerProgress) {
            throw new common_1.NotFoundException('Progreso del jugador no encontrado');
        }
        const allGameClues = await this.clueModel.find({
            gameId: clue.gameId
        }).sort({ order: 1 }).exec();
        const discoveredClueIds = playerProgress.clues
            .filter(pc => pc.status === clue_schema_1.ClueStatus.DISCOVERED)
            .map(pc => pc.clueId.toString());
        const discoveredClues = allGameClues.filter(gc => discoveredClueIds.includes(gc._id.toString()));
        let expectedNextOrder = 0;
        if (discoveredClues.length > 0) {
            const maxDiscoveredOrder = Math.max(...discoveredClues.map(dc => dc.order));
            expectedNextOrder = maxDiscoveredOrder + 1;
        }
        if (clue.order !== expectedNextOrder) {
            throw new common_1.BadRequestException(`Esta no es la pista que sigue en el orden.`);
        }
    }
    async findOrCreateCollaborativeAttempt(clue, playerId) {
        let attempt = await this.collaborativeAttemptModel.findOne({
            clueId: clue._id,
            status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE,
            expiresAt: { $gt: new Date() }
        }).exec();
        if (!attempt) {
            const now = new Date();
            console.log("tiempo : ", clue.collaborativeTimeLimit);
            const expiresAt = new Date(now.getTime() + (clue.collaborativeTimeLimit * 60 * 1000));
            attempt = new this.collaborativeAttemptModel({
                clueId: clue._id,
                gameId: clue.gameId,
                participantIds: [],
                requiredPlayers: clue.requiredPlayers,
                startedAt: now,
                expiresAt,
                status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE,
                initiatedBy: playerId,
            });
            await attempt.save();
        }
        return attempt;
    }
    async addPlayerToCollaborativeAttempt(attempt, playerId) {
        if (!attempt.participantIds.includes(playerId)) {
            attempt.participantIds.push(playerId);
            await attempt.save();
        }
        return attempt;
    }
    async completeCollaborativeAttempt(attempt, clue, game) {
        attempt.status = collaborative_attempt_schema_1.CollaborativeAttemptStatus.COMPLETED;
        attempt.completedAt = new Date();
        await attempt.save();
        clue.status = clue_schema_1.ClueStatus.DISCOVERED;
        clue.discoveredAt = new Date();
        await clue.save();
        for (const participantId of attempt.participantIds) {
            await this.updatePlayerProgressForCollaborativeClue(clue, participantId);
        }
        const totalDiscoveredClues = await this.clueModel.countDocuments({
            gameId: clue.gameId,
            status: clue_schema_1.ClueStatus.DISCOVERED
        }).exec();
        game.metadata.completedClues = totalDiscoveredClues;
        game.metadata.lastActivity = new Date();
        await game.save();
        await this.collaborativeAttemptModel.deleteOne({ _id: attempt._id }).exec();
    }
    async updatePlayerProgressForCollaborativeClue(clue, playerId) {
        const playerProgress = await this.playerProgressModel.findOne({
            gameId: clue.gameId,
            playerId
        }).exec();
        if (!playerProgress)
            return;
        const clueProgressIndex = playerProgress.clues.findIndex(pc => pc.clueId.toString() === clue._id.toString());
        if (clueProgressIndex >= 0) {
            playerProgress.clues[clueProgressIndex].status = clue_schema_1.ClueStatus.DISCOVERED;
            playerProgress.clues[clueProgressIndex].discoveredAt = new Date();
        }
        else {
            playerProgress.clues.push({
                clueId: new mongoose_2.Types.ObjectId(clue._id.toString()),
                status: clue_schema_1.ClueStatus.DISCOVERED,
                discoveredAt: new Date(),
            });
        }
        playerProgress.lastActivity = new Date();
        await playerProgress.save();
    }
    async expireOldCollaborativeAttempts() {
        const now = new Date();
        await this.collaborativeAttemptModel.updateMany({
            status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE,
            expiresAt: { $lt: now }
        }, {
            $set: { status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.EXPIRED }
        }).exec();
    }
    async getCollaborativeStatus(clueId, gameId) {
        if (!mongoose_2.Types.ObjectId.isValid(clueId) || !mongoose_2.Types.ObjectId.isValid(gameId)) {
            throw new common_1.BadRequestException('IDs inválidos');
        }
        const clue = await this.clueModel.findById(clueId).exec();
        if (!clue || !clue.isCollaborative) {
            throw new common_1.BadRequestException('La pista no es colaborativa');
        }
        const isClueDiscovered = clue.status === clue_schema_1.ClueStatus.DISCOVERED;
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
        console.log(`🔍 Buscando collaborative attempt para clueId: ${clueId}, gameId: ${gameId}`);
        console.log(`🔍 Tipos: clueId es ${typeof clueId}, gameId es ${typeof gameId}`);
        console.log(`🔍 ObjectId clueId: ${new mongoose_2.Types.ObjectId(clueId)}`);
        console.log(`🔍 ObjectId gameId: ${new mongoose_2.Types.ObjectId(gameId)}`);
        let attempt = await this.collaborativeAttemptModel.findOne({
            clueId: clueId,
            gameId: gameId
        })
            .sort({ startedAt: -1 })
            .exec();
        console.log(`📊 Búsqueda con strings - encontrado:`, !!attempt);
        if (!attempt) {
            attempt = await this.collaborativeAttemptModel.findOne({
                clueId: new mongoose_2.Types.ObjectId(clueId),
                gameId: new mongoose_2.Types.ObjectId(gameId)
            })
                .sort({ startedAt: -1 })
                .exec();
            console.log(`📊 Búsqueda con ObjectId - encontrado:`, !!attempt);
        }
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
        const now = new Date();
        const timeRemainingMs = Math.max(0, attempt.expiresAt.getTime() - now.getTime());
        const timeRemainingSeconds = Math.floor(timeRemainingMs / 1000);
        const minutes = Math.floor(timeRemainingSeconds / 60);
        const seconds = timeRemainingSeconds % 60;
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const currentParticipants = attempt.participantIds.length;
        const requiredParticipants = attempt.requiredPlayers;
        let attemptStatus;
        let canJoin;
        let message;
        let hasActiveAttempt;
        if (currentParticipants >= requiredParticipants) {
            attemptStatus = 'completed';
            canJoin = false;
            hasActiveAttempt = false;
            message = `Esta pista fue completada colaborativamente por ${currentParticipants} jugador(es)`;
        }
        else if (timeRemainingMs <= 0) {
            attemptStatus = 'expired';
            canJoin = false;
            hasActiveAttempt = false;
            message = `El tiempo expiró. Participaron ${currentParticipants} de ${requiredParticipants} jugadores necesarios`;
        }
        else {
            attemptStatus = 'active';
            canJoin = true;
            hasActiveAttempt = true;
            const playersNeeded = requiredParticipants - currentParticipants;
            message = `Se necesitan ${playersNeeded} jugador(es) más para completar esta pista`;
        }
        if (isClueDiscovered && currentParticipants < requiredParticipants) {
            message += ` (Nota: La pista fue descubierta por otros medios, no colaborativamente)`;
        }
        return {
            success: true,
            hasActiveAttempt,
            clue: clueInfo,
            collaborativeStatus: {
                currentParticipants,
                requiredParticipants,
                playersNeeded: Math.max(0, requiredParticipants - currentParticipants),
                timeRemaining: {
                    milliseconds: timeRemainingMs,
                    seconds: timeRemainingSeconds,
                    minutes,
                    formatted: formattedTime,
                    totalTimeLimit: clue.collaborativeTimeLimit
                },
                status: attemptStatus,
                canJoin,
                message,
                startedAt: attempt.startedAt,
                expiresAt: attempt.expiresAt,
                initiatedBy: attempt.initiatedBy,
                attemptId: attempt._id,
                isExpired: timeRemainingMs <= 0,
                isCompleted: currentParticipants >= requiredParticipants || isClueDiscovered
            }
        };
    }
    async checkIfAllPlayersCompleted(gameId) {
        const game = await this.gameModel.findById(gameId).exec();
        if (!game)
            return false;
        const totalClues = await this.clueModel.countDocuments({ gameId }).exec();
        for (const playerId of game.playerIds) {
            const playerProgress = await this.playerProgressModel.findOne({
                gameId,
                playerId
            }).exec();
            if (!playerProgress)
                return false;
            const playerDiscoveredCount = playerProgress.clues.filter(pc => pc.status === clue_schema_1.ClueStatus.DISCOVERED).length;
            if (playerDiscoveredCount < totalClues) {
                return false;
            }
        }
        return true;
    }
    async cleanupExpiredCollaborativeAttempts() {
        const now = new Date();
        const result = await this.collaborativeAttemptModel.deleteMany({
            expiresAt: { $lt: now },
            status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE
        });
        return result;
    }
    async createPlayerAchievement(playerId, game) {
        try {
            const completionTimeMs = game.finishedAt.getTime() - game.startedAt.getTime();
            const completionTimeMinutes = Math.round(completionTimeMs / (1000 * 60));
            const achievement = new this.playerAchievementModel({
                playerId,
                gameId: game._id,
                achievementType: player_achievement_schema_1.AchievementType.GAME_WIN,
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
        }
        catch (error) {
            console.error('Error creando achievement:', error);
        }
    }
    async getPlayerWins(playerId) {
        try {
            const playerWins = await this.playerAchievementModel
                .find({
                playerId,
                achievementType: player_achievement_schema_1.AchievementType.GAME_WIN
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
        }
        catch (error) {
            throw new common_1.BadRequestException(`Error al obtener las victorias del jugador: ${error.message}`);
        }
    }
    formatCompletionTime(totalMinutes) {
        if (totalMinutes < 1) {
            return 'Menos de 1 minuto';
        }
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        else {
            return `${minutes}m`;
        }
    }
    async getPlayerAchievementStats(playerId) {
        try {
            const stats = await this.playerAchievementModel.aggregate([
                { $match: { playerId } },
                {
                    $sort: { completedAt: -1 }
                },
                {
                    $group: {
                        _id: '$achievementType',
                        count: { $sum: 1 },
                        lastAchieved: { $max: '$completedAt' },
                        allGameDetails: {
                            $push: {
                                gameDetails: '$gameDetails',
                                gameId: '$gameId',
                                achievementId: '$_id',
                                completedAt: '$completedAt'
                            }
                        },
                        latestGameDetails: { $first: '$gameDetails' },
                        latestGameId: { $first: '$gameId' },
                        latestAchievementId: { $first: '$_id' }
                    }
                }
            ]).exec();
            const gameWins = await this.playerAchievementModel.find({
                playerId,
                achievementType: player_achievement_schema_1.AchievementType.GAME_WIN
            }).select('gameId').exec();
            const wonGameIds = new Set(gameWins.map(win => win.gameId.toString()));
            return {
                success: true,
                data: stats.reduce((acc, stat) => {
                    if (stat._id === 'game_participation') {
                        acc[stat._id] = {
                            count: stat.count,
                            lastAchieved: stat.lastAchieved,
                            allGames: stat.allGameDetails.map(game => ({
                                gameId: game.gameId,
                                achievementId: game.achievementId,
                                completedAt: game.completedAt,
                                isWinner: wonGameIds.has(game.gameId.toString()),
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
                    }
                    else {
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
        }
        catch (error) {
            throw new common_1.BadRequestException(`Error al obtener estadísticas de achievements: ${error.message}`);
        }
    }
    async processGameCompletionAchievements(gameId) {
        try {
            const gameObjectId = typeof gameId === 'string' ? new mongoose_2.Types.ObjectId(gameId) : gameId;
            const game = await this.gameModel.findById(gameObjectId).exec();
            if (!game) {
                console.error(`Juego con ID ${gameId} no encontrado para procesar logros`);
                return;
            }
            const allGameClues = await this.clueModel.find({ gameId: gameObjectId }).exec();
            const totalClues = allGameClues.length;
            const collaborativeClues = allGameClues.filter(clue => clue.isCollaborative);
            const totalCollaborativeClues = collaborativeClues.length;
            const gameStartTime = game.startedAt || game.createdAt;
            const gameEndTime = game.finishedAt || new Date();
            const totalGameTimeMs = gameEndTime.getTime() - gameStartTime.getTime();
            const totalGameTimeMinutes = Math.round(totalGameTimeMs / (1000 * 60));
            for (const playerId of game.playerIds) {
                await this.processPlayerAchievements(playerId, game, gameObjectId, totalClues, totalCollaborativeClues, totalGameTimeMinutes);
            }
            console.log(`✅ Logros procesados para ${game.playerIds.length} jugadores en juego: ${game.name}`);
        }
        catch (error) {
            console.error('Error procesando logros de completion:', error);
        }
    }
    async processPlayerAchievements(playerId, game, gameObjectId, totalClues, totalCollaborativeClues, totalGameTimeMinutes) {
        try {
            const playerProgress = await this.playerProgressModel.findOne({
                gameId: gameObjectId,
                playerId
            }).exec();
            if (!playerProgress) {
                console.warn(`No se encontró progreso para jugador ${playerId} en juego ${gameObjectId}`);
                return;
            }
            const playerStats = await this.calculatePlayerStats(playerId, gameObjectId, playerProgress, totalCollaborativeClues);
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
            const achievements = this.determinePlayerAchievements(playerStats, totalClues);
            for (const achievementType of achievements) {
                await this.createAchievementRecord(playerId, gameObjectId, achievementType, baseGameDetails);
            }
            console.log(`🏆 Logros creados para jugador ${playerId}: ${achievements.join(', ')}`);
        }
        catch (error) {
            console.error(`Error procesando logros para jugador ${playerId}:`, error);
        }
    }
    async calculatePlayerStats(playerId, gameId, playerProgress, totalCollaborativeClues) {
        const discoveredClues = playerProgress.clues.filter(clue => clue.status === clue_schema_1.ClueStatus.DISCOVERED);
        const cluesDiscovered = discoveredClues.length;
        const collaborativeCluesParticipated = await this.countCollaborativeParticipation(playerId, gameId);
        const allGameClues = await this.clueModel.find({ gameId }).exec();
        const completedAllClues = cluesDiscovered === allGameClues.length;
        return {
            cluesDiscovered,
            collaborativeCluesParticipated,
            completedAllClues
        };
    }
    async countCollaborativeParticipation(playerId, gameId) {
        try {
            const collaborativeAttempts = await this.collaborativeAttemptModel.find({
                gameId,
                participantIds: playerId,
                status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.COMPLETED
            }).exec();
            return collaborativeAttempts.length;
        }
        catch (error) {
            console.error('Error contando participación colaborativa:', error);
            return 0;
        }
    }
    determinePlayerAchievements(playerStats, totalClues) {
        const achievements = [];
        if (playerStats.completedAllClues) {
            achievements.push(player_achievement_schema_1.AchievementType.GAME_WIN);
        }
        if (playerStats.cluesDiscovered > 0) {
            achievements.push(player_achievement_schema_1.AchievementType.GAME_PARTICIPATION);
        }
        return achievements;
    }
    async createAchievementRecord(playerId, gameId, achievementType, gameDetails) {
        try {
            const existingAchievement = await this.playerAchievementModel.findOne({
                playerId,
                gameId,
                achievementType
            }).exec();
            if (existingAchievement) {
                console.log(`⚠️ Achievement ${achievementType} ya existe para jugador ${playerId} en juego ${gameId}`);
                return;
            }
            const achievement = new this.playerAchievementModel({
                playerId,
                gameId,
                achievementType,
                completedAt: new Date(),
                gameDetails
            });
            await achievement.save();
            console.log(`✅ Achievement ${achievementType} creado para jugador ${playerId}`);
        }
        catch (error) {
            console.error(`Error creando achievement ${achievementType} para jugador ${playerId}:`, error);
        }
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return Math.round(distance);
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    validateProximity(clue, playerLatitude, playerLongitude) {
        if (!clue.location || clue.location.latitude === undefined || clue.location.longitude === undefined) {
            throw new common_1.BadRequestException('Esta pista no tiene ubicación definida y no se puede descubrir por proximidad');
        }
        if (clue.range === undefined || clue.range === null) {
            throw new common_1.BadRequestException('Esta pista no tiene rango de descubrimiento definido');
        }
        if (clue.range <= 0) {
            throw new common_1.BadRequestException('El rango de descubrimiento de esta pista es inválido');
        }
        const distance = this.calculateDistance(playerLatitude, playerLongitude, clue.location.latitude, clue.location.longitude);
        if (distance > clue.range) {
            throw new common_1.BadRequestException(`Estás demasiado lejos de esta pista. Distancia actual: ${distance}m, rango requerido: ${clue.range}m. Necesitas acercarte ${distance - clue.range}m más.`);
        }
        console.log(`✅ Validación de proximidad exitosa: jugador a ${distance}m de la pista (rango: ${clue.range}m)`);
    }
};
exports.GamesService = GamesService;
exports.GamesService = GamesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(game_schema_1.Game.name)),
    __param(1, (0, mongoose_1.InjectModel)(clue_schema_1.Clue.name)),
    __param(2, (0, mongoose_1.InjectModel)(player_progress_schema_1.PlayerProgress.name)),
    __param(3, (0, mongoose_1.InjectModel)(collaborative_attempt_schema_1.CollaborativeAttempt.name)),
    __param(4, (0, mongoose_1.InjectModel)(player_achievement_schema_1.PlayerAchievement.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], GamesService);
//# sourceMappingURL=games.service.js.map