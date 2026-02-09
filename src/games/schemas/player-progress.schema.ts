import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Clue, ClueStatus } from '../../clues/schemas/clue.schema';

export type PlayerProgressDocument = PlayerProgress & Document;

@Schema({ timestamps: true })
export class PlayerProgress {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Game' })
  gameId: Types.ObjectId;

  @Prop({ required: true })
  playerId: string;

  @Prop({ type: [{ 
    clueId: { type: Types.ObjectId, ref: 'Clue' },
    status: { type: String, enum: ClueStatus, default: ClueStatus.HIDDEN },
    discoveredAt: { type: Date }
  }], default: [] })
  clues: {
    clueId: Types.ObjectId;
    status: ClueStatus;
    discoveredAt?: Date;
  }[];

  @Prop({ default: 0 })
  totalPoints: number;

  @Prop({ default: Date.now })
  lastActivity: Date;
}

export const PlayerProgressSchema = SchemaFactory.createForClass(PlayerProgress);