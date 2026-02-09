import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SponsorDocument = Sponsor & Document;

@Schema({ 
  timestamps: true,
  collection: 'sponsors'
})
export class Sponsor {
  @Prop({ 
    required: true, 
    unique: true,
    trim: true,
    match: /^[0-9]{8,15}-[0-9]$/
  })
  nit: string;

  @Prop({ 
    required: true,
    trim: true,
    maxlength: 200
  })
  nombreEmpresa: string;

  @Prop({ 
    required: true,
    trim: true,
    maxlength: 100
  })
  representanteLegal: string;

  @Prop({ 
    required: true,
    trim: true,
    match: /^(\+57|57)?[3][0-9]{9}$/
  })
  celular: string;

  @Prop({ 
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  })
  correo: string;

  @Prop({ 
    required: true,
    trim: true
  })
  logo: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

   @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId; // ← Vinculación opcional con User
}

export const SponsorSchema = SchemaFactory.createForClass(Sponsor);

// Índices adicionales
SponsorSchema.index({ nit: 1 }, { unique: true });
SponsorSchema.index({ nombreEmpresa: 1 });
SponsorSchema.index({ correo: 1 });

// Middleware para actualizar updatedAt
SponsorSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: new Date() });
});

SponsorSchema.pre('updateOne', function() {
  this.set({ updatedAt: new Date() });
});

SponsorSchema.pre('updateMany', function() {
  this.set({ updatedAt: new Date() });
});