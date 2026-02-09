import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlayerAchievementDocument = PlayerAchievement & Document;

export enum AchievementType {
  GAME_WIN = 'game_win',
  GAME_PARTICIPATION = 'game_participation', // Nuevo - participó en el juego
  FIRST_CLUE = 'first_clue', 
  SPEED_RUN = 'speed_run',
  COLLABORATIVE_MASTER = 'collaborative_master'
}

@Schema({ timestamps: true })
export class PlayerAchievement {
  @Prop({ required: true, index: true })
  playerId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Game', index: true })
  gameId: Types.ObjectId;

  @Prop({ 
    required: true, 
    type: String, 
    enum: AchievementType,
    default: AchievementType.GAME_WIN,
    index: true
  })
  achievementType: AchievementType;

  @Prop({ required: true, index: true })
  completedAt: Date;

  @Prop({
    type: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      totalClues: { type: Number, required: true },
      startedAt: { type: Date, required: true },
      completionTimeMinutes: { type: Number, required: true },
      // Nuevos campos para estadísticas del jugador
      playerStats: {
        cluesDiscovered: { type: Number, required: true },
        collaborativeCluesParticipated: { type: Number, required: true },
        totalParticipants: { type: Number, required: true }
      }
    },
    _id: false
  })
  gameDetails: {
    name: string;
    description: string;
    totalClues: number;
    startedAt: Date;
    completionTimeMinutes: number;
    playerStats: {
      cluesDiscovered: number;
      collaborativeCluesParticipated: number;
      totalParticipants: number;
    };
  };
}

export const PlayerAchievementSchema = SchemaFactory.createForClass(PlayerAchievement);

// Índices compuestos para consultas eficientes
PlayerAchievementSchema.index({ playerId: 1, achievementType: 1 });
PlayerAchievementSchema.index({ playerId: 1, completedAt: -1 });
PlayerAchievementSchema.index({ achievementType: 1, completedAt: -1 });