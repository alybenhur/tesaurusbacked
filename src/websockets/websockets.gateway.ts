import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface ClientInfo {
  userId: string;
  gameId?: string;
  userName?: string;
  joinedAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, especificar dominios permitidos
    methods: ['GET', 'POST'],
  },
  namespace: '/', // Namespace principal
})
export class WebsocketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketsGateway.name);
  private clients = new Map<string, ClientInfo>();

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
    
    // Enviar mensaje de bienvenida
    client.emit('connection_established', {
      clientId: client.id,
      timestamp: new Date(),
      message: 'Conectado al servidor de Treasure Hunt Montería'
    });
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    
    if (clientInfo) {
      this.logger.log(`Cliente desconectado: ${client.id} (${clientInfo.userName || 'Anónimo'})`);
      
      // Notificar al juego si el cliente estaba en uno
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

  @SubscribeMessage('join_user')
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; userName?: string }
  ) {
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

  @SubscribeMessage('join_game')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string; userName?: string }
  ) {
    const clientInfo = this.clients.get(client.id);
    
    
    if (clientInfo) {
      // Actualizar información del cliente con el juego
      this.clients.set(client.id, {
        ...clientInfo,
        gameId: data.gameId
      });

      // Unir al cliente a la sala del juego
      client.join(`game_${data.gameId}`);

      this.logger.log(`${data.userName || data.userId} se unió al juego ${data.gameId}`);
      
      // Notificar al cliente que se unió exitosamente
      client.emit('game_joined', {
        gameId: data.gameId,
        message: 'Te has unido al juego exitosamente'
      });

      // Notificar a otros jugadores en el juego
      client.to(`game_${data.gameId}`).emit('player_joined_game', {
        gameId: data.gameId,
        playerId: data.userId,
        playerName: data.userName,
        message: `${data.userName || 'Un jugador'} se ha unido al juego`
      });
    }
  }

  @SubscribeMessage('leave_game')
  handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string; userName?: string }
  ) {
    const clientInfo = this.clients.get(client.id);
    
    if (clientInfo && clientInfo.gameId === data.gameId) {
      // Remover del juego
      client.leave(`game_${data.gameId}`);
      
      // Actualizar información del cliente
      this.clients.set(client.id, {
        ...clientInfo,
        gameId: undefined
      });

      this.logger.log(`${data.userName || data.userId} abandonó el juego ${data.gameId}`);
      
      // Notificar a otros jugadores
      client.to(`game_${data.gameId}`).emit('player_left_game', {
        gameId: data.gameId,
        playerId: data.userId,
        playerName: data.userName,
        message: `${data.userName || 'Un jugador'} ha abandonado el juego`
      });

      // Confirmar al cliente
      client.emit('game_left', {
        gameId: data.gameId,
        message: 'Has abandonado el juego'
      });
    }
  }

  @SubscribeMessage('update_location')
  handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      gameId: string; 
      userId: string; 
      location: { latitude: number; longitude: number } 
    }
  ) {
    const clientInfo = this.clients.get(client.id);
    
    if (clientInfo && clientInfo.gameId === data.gameId) {
      // Emitir ubicación actualizada a otros jugadores del juego
      client.to(`game_${data.gameId}`).emit('player_location_updated', {
        gameId: data.gameId,
        playerId: data.userId,
        location: data.location,
        timestamp: new Date()
      });
    }
  }

  @SubscribeMessage('clue_discovered')
  handleClueDiscovered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      gameId: string;
      clueId: string;
      playerId: string;
      playerName?: string;
      clueTitle: string;
    }
  ) {
    this.logger.log(`Pista ${data.clueTitle} descubierta por ${data.playerName || data.playerId}`);
    
    // Notificar a todos los jugadores del juego
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

  @SubscribeMessage('request_game_state')
  handleRequestGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string }
  ) {
    // Este evento se puede usar para sincronizar el estado del juego
    client.emit('game_state_requested', {
      gameId: data.gameId,
      timestamp: new Date(),
      message: 'Estado del juego solicitado'
    });
  }

  // Métodos públicos para emitir eventos desde servicios

  /**
   * Emite un evento a todos los clientes conectados
   */
  emitToAll(event: string, data: any) {
    this.server.emit(event, {
      ...data,
      timestamp: new Date()
    });
    this.logger.log(`Evento "${event}" emitido a todos los clientes`);
  }

  /**
   * Emite un evento a todos los jugadores de un juego específico
   */
  emitToGame(gameId: string, event: string, data: any) {
    this.server.to(`game_${gameId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
    this.logger.log(`Evento "${event}" emitido al juego ${gameId}`);
  }

  /**
   * Emite un evento a un cliente específico
   */
  emitToClient(clientId: string, event: string, data: any) {
    this.server.to(clientId).emit(event, {
      ...data,
      timestamp: new Date()
    });
    this.logger.log(`Evento "${event}" emitido al cliente ${clientId}`);
  }

  /**
   * Emite un evento a un usuario específico (busca por userId)
   */
  emitToUser(userId: string, event: string, data: any) {
    // Buscar el cliente por userId
    for (const [clientId, clientInfo] of this.clients.entries()) {
      if (clientInfo.userId === userId) {
        this.emitToClient(clientId, event, data);
        break;
      }
    }
  }

  /**
   * Obtiene estadísticas de conexiones
   */
  getConnectionStats() {
    const totalClients = this.clients.size;
    const gamesWithPlayers = new Map<string, number>();
    
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

  /**
   * Desconecta a todos los clientes de un juego
   */
  disconnectGameClients(gameId: string, reason: string) {
    this.emitToGame(gameId, 'force_disconnect', {
      gameId,
      reason,
      message: `Desconectado del juego: ${reason}`
    });

    // Remover a todos los clientes del juego
    for (const [clientId, clientInfo] of this.clients.entries()) {
      if (clientInfo.gameId === gameId) {
        this.clients.set(clientId, {
          ...clientInfo,
          gameId: undefined
        });
      }
    }
  }

  /**
   * Programa la revelación automática de una pista
   */
  scheduleClueReveal(gameId: string, clueId: string, clueTitle: string, delayMs: number) {
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
}