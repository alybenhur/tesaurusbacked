import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class WebsocketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    private clients;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinUser(client: Socket, data: {
        userId: string;
        userName?: string;
    }): void;
    handleJoinGame(client: Socket, data: {
        gameId: string;
        userId: string;
        userName?: string;
    }): void;
    handleLeaveGame(client: Socket, data: {
        gameId: string;
        userId: string;
        userName?: string;
    }): void;
    handleUpdateLocation(client: Socket, data: {
        gameId: string;
        userId: string;
        location: {
            latitude: number;
            longitude: number;
        };
    }): void;
    handleClueDiscovered(client: Socket, data: {
        gameId: string;
        clueId: string;
        playerId: string;
        playerName?: string;
        clueTitle: string;
    }): void;
    handleRequestGameState(client: Socket, data: {
        gameId: string;
    }): void;
    emitToAll(event: string, data: any): void;
    emitToGame(gameId: string, event: string, data: any): void;
    emitToClient(clientId: string, event: string, data: any): void;
    emitToUser(userId: string, event: string, data: any): void;
    getConnectionStats(): {
        totalConnectedClients: number;
        activeGames: number;
        gamesWithPlayers: {
            [k: string]: number;
        };
        timestamp: Date;
    };
    disconnectGameClients(gameId: string, reason: string): void;
    scheduleClueReveal(gameId: string, clueId: string, clueTitle: string, delayMs: number): void;
}
