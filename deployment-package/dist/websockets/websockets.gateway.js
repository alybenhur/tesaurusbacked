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
var WebsocketsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsocketsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let WebsocketsGateway = WebsocketsGateway_1 = class WebsocketsGateway {
    constructor() {
        this.logger = new common_1.Logger(WebsocketsGateway_1.name);
        this.clients = new Map();
    }
    handleConnection(client) {
        this.logger.log(`Cliente conectado: ${client.id}`);
        client.emit('connection_established', {
            clientId: client.id,
            timestamp: new Date(),
            message: 'Conectado al servidor de Treasure Hunt Montería'
        });
    }
    handleDisconnect(client) {
        const clientInfo = this.clients.get(client.id);
        if (clientInfo) {
            this.logger.log(`Cliente desconectado: ${client.id} (${clientInfo.userName || 'Anónimo'})`);
            if (clientInfo.gameId) {
                this.emitToGame(clientInfo.gameId, 'player_disconnected', {
                    playerId: clientInfo.userId,
                    userName: clientInfo.userName,
                    message: `${clientInfo.userName || 'Un jugador'} se ha desconectado`
                });
            }
            this.clients.delete(client.id);
        }
    }
    handleJoinUser(client, data) {
        this.clients.set(client.id, {
            userId: data.userId,
            userName: data.userName,
            joinedAt: new Date()
        });
        this.logger.log(`Usuario registrado: ${data.userName || data.userId} (${client.id})`);
        client.emit('user_joined', {
            userId: data.userId,
            userName: data.userName,
            message: 'Usuario registrado exitosamente'
        });
    }
    handleJoinGame(client, data) {
        const clientInfo = this.clients.get(client.id);
        if (clientInfo) {
            this.clients.set(client.id, {
                ...clientInfo,
                gameId: data.gameId
            });
            client.join(`game_${data.gameId}`);
            this.logger.log(`${data.userName || data.userId} se unió al juego ${data.gameId}`);
            client.emit('game_joined', {
                gameId: data.gameId,
                message: 'Te has unido al juego exitosamente'
            });
            client.to(`game_${data.gameId}`).emit('player_joined_game', {
                gameId: data.gameId,
                playerId: data.userId,
                playerName: data.userName,
                message: `${data.userName || 'Un jugador'} se ha unido al juego`
            });
        }
    }
    handleLeaveGame(client, data) {
        const clientInfo = this.clients.get(client.id);
        if (clientInfo && clientInfo.gameId === data.gameId) {
            client.leave(`game_${data.gameId}`);
            this.clients.set(client.id, {
                ...clientInfo,
                gameId: undefined
            });
            this.logger.log(`${data.userName || data.userId} abandonó el juego ${data.gameId}`);
            client.to(`game_${data.gameId}`).emit('player_left_game', {
                gameId: data.gameId,
                playerId: data.userId,
                playerName: data.userName,
                message: `${data.userName || 'Un jugador'} ha abandonado el juego`
            });
            client.emit('game_left', {
                gameId: data.gameId,
                message: 'Has abandonado el juego'
            });
        }
    }
    handleUpdateLocation(client, data) {
        const clientInfo = this.clients.get(client.id);
        if (clientInfo && clientInfo.gameId === data.gameId) {
            client.to(`game_${data.gameId}`).emit('player_location_updated', {
                gameId: data.gameId,
                playerId: data.userId,
                location: data.location,
                timestamp: new Date()
            });
        }
    }
    handleClueDiscovered(client, data) {
        this.logger.log(`Pista ${data.clueTitle} descubierta por ${data.playerName || data.playerId}`);
        this.emitToGame(data.gameId, 'clue_discovered', {
            gameId: data.gameId,
            clueId: data.clueId,
            playerId: data.playerId,
            playerName: data.playerName,
            clueTitle: data.clueTitle,
            discoveredAt: new Date(),
            message: `${data.playerName || 'Un jugador'} ha descubierto la pista "${data.clueTitle}"`
        });
    }
    handleRequestGameState(client, data) {
        client.emit('game_state_requested', {
            gameId: data.gameId,
            timestamp: new Date(),
            message: 'Estado del juego solicitado'
        });
    }
    emitToAll(event, data) {
        this.server.emit(event, {
            ...data,
            timestamp: new Date()
        });
        this.logger.log(`Evento "${event}" emitido a todos los clientes`);
    }
    emitToGame(gameId, event, data) {
        this.server.to(`game_${gameId}`).emit(event, {
            ...data,
            timestamp: new Date()
        });
        this.logger.log(`Evento "${event}" emitido al juego ${gameId}`);
    }
    emitToClient(clientId, event, data) {
        this.server.to(clientId).emit(event, {
            ...data,
            timestamp: new Date()
        });
        this.logger.log(`Evento "${event}" emitido al cliente ${clientId}`);
    }
    emitToUser(userId, event, data) {
        for (const [clientId, clientInfo] of this.clients.entries()) {
            if (clientInfo.userId === userId) {
                this.emitToClient(clientId, event, data);
                break;
            }
        }
    }
    getConnectionStats() {
        const totalClients = this.clients.size;
        const gamesWithPlayers = new Map();
        for (const clientInfo of this.clients.values()) {
            if (clientInfo.gameId) {
                const currentCount = gamesWithPlayers.get(clientInfo.gameId) || 0;
                gamesWithPlayers.set(clientInfo.gameId, currentCount + 1);
            }
        }
        return {
            totalConnectedClients: totalClients,
            activeGames: gamesWithPlayers.size,
            gamesWithPlayers: Object.fromEntries(gamesWithPlayers),
            timestamp: new Date()
        };
    }
    disconnectGameClients(gameId, reason) {
        this.emitToGame(gameId, 'force_disconnect', {
            gameId,
            reason,
            message: `Desconectado del juego: ${reason}`
        });
        for (const [clientId, clientInfo] of this.clients.entries()) {
            if (clientInfo.gameId === gameId) {
                this.clients.set(clientId, {
                    ...clientInfo,
                    gameId: undefined
                });
            }
        }
    }
    scheduleClueReveal(gameId, clueId, clueTitle, delayMs) {
        setTimeout(() => {
            this.emitToGame(gameId, 'clue_revealed', {
                gameId,
                clueId,
                clueTitle,
                revealedAt: new Date(),
                message: `La pista "${clueTitle}" ahora es visible para todos los jugadores`
            });
            this.logger.log(`Pista "${clueTitle}" revelada automáticamente en el juego ${gameId}`);
        }, delayMs);
    }
};
exports.WebsocketsGateway = WebsocketsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], WebsocketsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_user'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WebsocketsGateway.prototype, "handleJoinUser", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_game'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WebsocketsGateway.prototype, "handleJoinGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_game'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WebsocketsGateway.prototype, "handleLeaveGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('update_location'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WebsocketsGateway.prototype, "handleUpdateLocation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('clue_discovered'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WebsocketsGateway.prototype, "handleClueDiscovered", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('request_game_state'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], WebsocketsGateway.prototype, "handleRequestGameState", null);
exports.WebsocketsGateway = WebsocketsGateway = WebsocketsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        namespace: '/',
    })
], WebsocketsGateway);
//# sourceMappingURL=websockets.gateway.js.map