import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ClueStatus {
  HIDDEN = 'hidden',
  DISCOVERED = 'discovered',
  REVEALED = 'revealed',
}

@Schema()
export class ClueLocation {
  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop()
  address?: string;

  @Prop()
  description?: string;
}

@Schema({ timestamps: true })
export class Clue extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Game' })
  gameId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  hint?: string;

   @Prop({ 
    required: true, 
    unique: true, 
    index: true 
  })
  idPista: string;

  @Prop({ type: ClueLocation })
  location?: ClueLocation;

  @Prop()
  qrCode?: string;

  @Prop({ required: true, default: 0 })
  order: number;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ enum: ClueStatus, default: ClueStatus.HIDDEN })
  status: ClueStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  discoveredBy?: Types.ObjectId;

  @Prop()
  discoveredAt?: Date;

  @Prop()
  range?: number;

  @Prop()
  answer?: string;

  @Prop()
  imageUrl?: string;

  @Prop({ type: Object })
  content?: Record<string, any>;

  @Prop({ type: [String] })
  hints?: string[];

  @Prop()
  pointsValue?: number;

  @Prop()
  timeLimit?: number;

  @Prop({ required: true })
  type: string;

  // ✅ NUEVO: Campos para pistas colaborativas
  @Prop({ default: false })
  isCollaborative: boolean;

  @Prop({ 
    type: Number,
    min: 2,
    max: 20,
    validate: {
      validator: function(this: Clue, value: number) {
        // Solo validar si la pista es colaborativa
        return !this.isCollaborative || (value >= 2 && value <= 20);
      },
      message: 'requiredPlayers debe estar entre 2 y 20 para pistas colaborativas'
    }
  })
  requiredPlayers?: number;

  @Prop({ 
  type: Number,
  min: 1, // Mínimo 1 minuto
  max: 60, // Máximo 60 minutos (1 hora)
  validate: {
    validator: function(this: Clue, value: number) {
      return !this.isCollaborative || (value >= 1 && value <= 60);
    },
    message: 'collaborativeTimeLimit debe estar entre 1 minuto y 60 minutos (1 hora)'
  }
})
collaborativeTimeLimit?: number; // Tiempo en minutos
}

// ✅ AGREGADO: Exportar el tipo ClueDocument
export type ClueDocument = Clue & Document;

export const ClueSchema = SchemaFactory.createForClass(Clue);