import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum CollaborativeAttemptStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true })
export class CollaborativeAttempt {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Clue', index: true })
  clueId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Game', index: true })
  gameId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  participantIds: string[];

  @Prop({ required: true, min: 2, max: 20 })
  requiredPlayers: number;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ required: true, index: true }) // Índice para queries de expiración
  expiresAt: Date;

  @Prop({ 
    type: String, 
    enum: CollaborativeAttemptStatus, 
    default: CollaborativeAttemptStatus.ACTIVE,
    index: true 
  })
  status: CollaborativeAttemptStatus;

  @Prop({ required: true })
  initiatedBy: string; // El primer jugador que escaneó

  @Prop()
  completedAt?: Date;

  // Índice compuesto para búsquedas eficientes
  // MongoDB creará automáticamente índices para clueId, gameId y status
}

export type CollaborativeAttemptDocument = CollaborativeAttempt & Document;

export const CollaborativeAttemptSchema = SchemaFactory.createForClass(CollaborativeAttempt);

// ✅ Crear índices compuestos para optimizar consultas
CollaborativeAttemptSchema.index({ clueId: 1, status: 1 });
CollaborativeAttemptSchema.index({ gameId: 1, status: 1 });
CollaborativeAttemptSchema.index({ expiresAt: 1, status: 1 }); // Para cleanup automático