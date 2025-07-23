import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GameDocument = Game & Document & {
  createdAt: Date;
  updatedAt: Date;
};

export enum GameStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({ 
  timestamps: true, // Esto crea automáticamente createdAt y updatedAt
  collection: 'games'
})
export class Game {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true })
  adminId: string;

  @Prop({ 
    type: String, 
    enum: GameStatus, 
    default: GameStatus.WAITING 
  })
  status: GameStatus;

  @Prop({ type: [String], default: [] })
  playerIds: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Clue' }] })
  clues: Types.ObjectId[];

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  finishedAt?: Date;

    // ✅ NUEVO CAMPO: ID del jugador ganador
  @Prop({ type: String, required: false })
  winnerId?: string;

  @Prop({ default: 8, min: 2, max: 20 })
  maxPlayers: number;

  @Prop({ default: 600000 }) // 10 minutos en millisegundos
  revealDelayMs: number;

  // Coordenadas del área de juego (Montería)
  @Prop({
    type: {
      center: {
        latitude: { type: Number, default: 8.7574 },
        longitude: { type: Number, default: -75.8814 }
      },
      bounds: {
        northEast: {
          latitude: { type: Number, default: 8.7800 },
          longitude: { type: Number, default: -75.8600 }
        },
        southWest: {
          latitude: { type: Number, default: 8.7300 },
          longitude: { type: Number, default: -75.9000 }
        }
      }
    },
    _id: false
  })
  gameArea: {
    center: { latitude: number; longitude: number };
    bounds: {
      northEast: { latitude: number; longitude: number };
      southWest: { latitude: number; longitude: number };
    };
  };

  // Metadatos del juego
  @Prop({
    type: {
      totalClues: { type: Number, default: 0 },
      completedClues: { type: Number, default: 0 },
      lastActivity: { type: Date, default: Date.now }
    },
    _id: false
  })
  metadata: {
    totalClues: number;
    completedClues: number;
    lastActivity: Date;
  };

  // Los campos createdAt y updatedAt se agregan automáticamente por timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const GameSchema = SchemaFactory.createForClass(Game);