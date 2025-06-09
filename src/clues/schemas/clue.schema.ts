import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClueDocument = Clue & Document;

export enum ClueStatus {
  HIDDEN = 'hidden',
  DISCOVERED = 'discovered',
  REVEALED = 'revealed',
}

@Schema({ 
  timestamps: true,
  collection: 'clues'
})
export class Clue {
  @Prop({ type: Types.ObjectId, ref: 'Game', required: true })
  gameId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  order: number;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  hint: string;

  // Ubicación GPS de la pista
  @Prop({
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      accuracy: { type: Number, default: 10 }, // metros
    },
    required: true,
    _id: false
  })
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };

  // Código QR único global
  @Prop({ 
    required: true, 
    unique: true,
    uppercase: true,
    match: /^CLUE_[A-Z]{4}_[0-9]{4}$/
  })
  qrCode: string;

  @Prop({ 
    type: String, 
    enum: ClueStatus, 
    default: ClueStatus.HIDDEN 
  })
  status: ClueStatus;

  // Radio de geofencing en metros
  @Prop({ default: 50, min: 10, max: 500 })
  radius: number;

  // Información de descubrimiento
  @Prop({ type: String })
  discoveredBy?: string;

  @Prop({ type: Date })
  discoveredAt?: Date;

  @Prop({ type: Date })
  revealedAt?: Date;

  // Programación de revelación automática
  @Prop({ type: Date })
  scheduledRevealAt?: Date;

  // Metadatos adicionales
  @Prop({
    type: {
      difficulty: { type: Number, min: 1, max: 5, default: 1 },
      points: { type: Number, default: 100 },
      category: { type: String, default: 'general' },
      isActive: { type: Boolean, default: true }
    },
    _id: false
  })
  metadata: {
    difficulty: number;
    points: number;
    category: string;
    isActive: boolean;
  };

  // Verificación de ubicación física
  @Prop({
    type: {
      verificationRequired: { type: Boolean, default: true },
      lastVerifiedAt: { type: Date },
      verifiedBy: { type: String }
    },
    _id: false
  })
  verification: {
    verificationRequired: boolean;
    lastVerifiedAt?: Date;
    verifiedBy?: string;
  };
}

export const ClueSchema = SchemaFactory.createForClass(Clue);

// Índices para optimizar consultas
ClueSchema.index({ gameId: 1, order: 1 });
ClueSchema.index({ qrCode: 1 }, { unique: true });
ClueSchema.index({ status: 1 });
ClueSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
ClueSchema.index({ scheduledRevealAt: 1 });