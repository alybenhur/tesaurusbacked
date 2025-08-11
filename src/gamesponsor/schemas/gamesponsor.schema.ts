import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GameSponsorAssociationDocument = GameSponsorAssociation & Document;

@Schema({ timestamps: true })
export class GameSponsorAssociation {
  @Prop({ type: Types.ObjectId, ref: 'Game', required: true })
  gameId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Sponsor', required: true })
  sponsorId: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Clue', 
    default: null,
    required: false 
  })
  clueId: Types.ObjectId | null; // null = sponsor general, valor = sponsor de pista específica

  @Prop({ 
    type: String, 
    enum: ['main', 'secondary', 'media', 'prize'], 
    default: 'secondary' 
  })
  sponsorshipType: string;

  @Prop({ type: Number, min: 0 })
  sponsorshipAmount?: number;

  @Prop({ type: String })
  sponsorshipDescription?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  totalUnlocks: number; // Total de veces que este sponsor ha desbloqueado la pista (para diferentes jugadores)

  @Prop({
    type: [{
      playerId: { type: Types.ObjectId, ref: 'User', required: true },
      unlockedAt: { type: Date, default: Date.now },
      _id: false // No crear _id para los subdocumentos
    }],
    default: []
  })
  unlockedFor: Array<{
    playerId: Types.ObjectId;
    unlockedAt: Date;
  }>; // Array de jugadores que ya han usado este sponsor para desbloquear la pista

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  // Virtual para identificar el tipo de patrocinio
  get isGeneralSponsor(): boolean {
    return this.clueId === null;
  }

  get isClueSponsor(): boolean {
    return this.clueId !== null;
  }

  // Virtual para verificar si está disponible para desbloquear (sin restricción de jugador específico)
  get canUnlock(): boolean {
    return this.isClueSponsor && this.isActive;
  }

  // Método para verificar si un jugador específico ya usó este sponsor
  hasPlayerUsedSponsor(playerId: string | Types.ObjectId): boolean {
    const playerObjectId = typeof playerId === 'string' ? new Types.ObjectId(playerId) : playerId;
    return this.unlockedFor.some(unlock => unlock.playerId.equals(playerObjectId));
  }

  // Método para verificar si un jugador puede usar este sponsor
  canPlayerUseSponsor(playerId: string | Types.ObjectId): boolean {
    return this.canUnlock && !this.hasPlayerUsedSponsor(playerId);
  }
}

export const GameSponsorAssociationSchema = SchemaFactory.createForClass(GameSponsorAssociation);

// Índice único compuesto: Un sponsor solo puede tener UN tipo de asociación por juego
GameSponsorAssociationSchema.index({ gameId: 1, sponsorId: 1 }, { unique: true });

// Índices para búsquedas eficientes
GameSponsorAssociationSchema.index({ gameId: 1, clueId: 1 });
GameSponsorAssociationSchema.index({ sponsorId: 1, isActive: 1 });

// Índice para búsquedas por jugador en el array unlockedFor
GameSponsorAssociationSchema.index({ 'unlockedFor.playerId': 1 });

// Configurar virtuals
GameSponsorAssociationSchema.set('toJSON', { virtuals: true });
GameSponsorAssociationSchema.set('toObject', { virtuals: true });

// Método de instancia para registrar un desbloqueo
GameSponsorAssociationSchema.methods.unlockForPlayer = function(playerId: string | Types.ObjectId) {
  const playerObjectId = typeof playerId === 'string' ? new Types.ObjectId(playerId) : playerId;
  
  // Verificar si el jugador ya usó este sponsor
  if (this.hasPlayerUsedSponsor(playerObjectId)) {
    throw new Error('Player has already used this sponsor');
  }
  
  // Verificar si puede desbloquear
  if (!this.canUnlock) {
    throw new Error('Sponsor cannot unlock clues');
  }
  
  // Agregar el jugador al array
  this.unlockedFor.push({
    playerId: playerObjectId,
    unlockedAt: new Date()
  });
  
  // Incrementar contador
  this.totalUnlocks += 1;
  
  return this.save();
};