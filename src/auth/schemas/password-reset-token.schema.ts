// src/auth/schemas/password-reset-token.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PasswordResetTokenDocument = PasswordResetToken & Document;

@Schema({ timestamps: true })
export class PasswordResetToken {
  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  })
  userId: Types.ObjectId;

  @Prop({ 
    required: true,
    length: 4,
    match: /^\d{4}$/ // Solo acepta exactamente 4 dígitos
  })
  token: string;

  @Prop({ 
    required: true,
    index: true // Índice para consultas de expiración eficientes
  })
  expiresAt: Date;

  @Prop({ 
    default: false,
    index: true 
  })
  isUsed: boolean;

  @Prop({ 
    default: 0,
    max: 3 // Máximo 3 intentos de verificación
  })
  attempts: number;

  @Prop({ default: Date.now })
  createdAt?: Date;

  @Prop({ default: Date.now })
  updatedAt?: Date;

  // Método virtual para verificar si el token ha expirado
  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  // Método virtual para verificar si el token es válido
  get isValid(): boolean {
    return !this.isUsed && !this.isExpired && this.attempts < 3;
  }
}

export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetToken);

// Índices compuestos para optimización
PasswordResetTokenSchema.index({ userId: 1, token: 1 });
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index para auto-eliminación

// Virtuals - habilitar en el schema
PasswordResetTokenSchema.set('toJSON', { virtuals: true });
PasswordResetTokenSchema.set('toObject', { virtuals: true });

// Middleware para incrementar intentos
PasswordResetTokenSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  this.updatedAt = new Date();
  return this.save();
};

// Middleware para marcar como usado
PasswordResetTokenSchema.methods.markAsUsed = function() {
  this.isUsed = true;
  this.updatedAt = new Date();
  return this.save();
};

// Método estático para generar código de 4 dígitos
PasswordResetTokenSchema.statics.generateToken = function(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Método estático para calcular tiempo de expiración (por defecto 10 minutos)
PasswordResetTokenSchema.statics.calculateExpirationTime = function(minutes: number = 10): Date {
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + minutes);
  return expirationTime;
};