import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuctionDocument = Auction & Document;

export enum AuctionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FINISHED = 'finished',
}

@Schema()
export class BiddableClue {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Clue' })
  clueId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  currentBid: number;

  @Prop({ type: Types.ObjectId, ref: 'Sponsor' })
  currentBidderId?: Types.ObjectId;

  @Prop({ default: false })
  isWon: boolean;
}

@Schema({ 
  timestamps: true,
  collection: 'auctions'
})
export class Auction {
  @Prop({ 
    required: true, 
    unique: true, 
    type: Types.ObjectId, 
    ref: 'Game' 
  })
  gameId: Types.ObjectId;

  @Prop({ 
    required: true, 
    min: 0 
  })
  startingAmount: number;

  @Prop({ 
    required: true, 
    min: 1 
  })
  incrementValue: number;

  @Prop({ 
    type: String, 
    enum: AuctionStatus, 
    default: AuctionStatus.ACTIVE 
  })
  status: AuctionStatus;

  @Prop({ 
    type: [BiddableClue], 
    default: [] 
  })
  biddableClues: BiddableClue[];

  @Prop({ 
    required: true,
    type: Date 
  })
  closingDate: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AuctionSchema = SchemaFactory.createForClass(Auction);

// Índices para optimizar consultas
AuctionSchema.index({ gameId: 1 }, { unique: true });
AuctionSchema.index({ status: 1 });
AuctionSchema.index({ closingDate: 1 });