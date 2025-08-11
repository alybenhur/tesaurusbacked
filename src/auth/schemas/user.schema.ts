// src/auth/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  ADMIN = 'admin',
  PLAYER = 'player',
  MODERATOR = 'moderator',
  SPONSOR ='sponsor'
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, minlength: 6 })
  password: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.PLAYER })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: Date.now })
  lastLogin: Date;

  @Prop({ type: [String], default: [] })
  discoveredClues: string[];

  @Prop({ type: Number, default: 0 })
  totalScore: number;

  @Prop({ type: String })
  refreshToken?: string;

    @Prop({ default: Date.now })
  createdAt?: Date;

  @Prop({ default: Date.now })
  updatedAt?: Date;
  // Campos calculados

    @Prop({ type: Types.ObjectId, ref: 'Sponsor', required: false })
  sponsorId?: Types.ObjectId; // ← Vinculación opcional con Sponsor

  // Getter específico para sponsors
  get isSponsor(): boolean {
    return this.role === UserRole.SPONSOR;
  }
  
  get canCreateGames(): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.MODERATOR;
  }

  get canModerateGames(): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.MODERATOR;
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

// Índices para optimización
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

// Middleware para hash de contraseña antes de guardar
UserSchema.pre('save', async function (next) {
  const user = this as UserDocument;
  
  // Solo hash la contraseña si ha sido modificada
  if (!user.isModified('password')) return next();
  
  const bcrypt = require('bcryptjs');
  user.password = await bcrypt.hash(user.password, 12);
  next();
});

// Método para comparar contraseñas
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(candidatePassword, this.password);
};

// Método para transformar a JSON (excluir campos sensibles)
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.refreshToken;
  delete user.__v;
  return user;
};