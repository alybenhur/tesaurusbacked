import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BidDocument = Bid & Document;

@Schema({ 
  timestamps: true,
  collection: 'bids'
})
export class Bid {
  @Prop({ 
    required: true, 
    type: Types.ObjectId, 
    ref: 'Auction' 
  })
  auctionId: Types.ObjectId;

  @Prop({ 
    required: true, 
    type: Types.ObjectId, 
    ref: 'Clue' 
  })
  clueId: Types.ObjectId;

  @Prop({ 
    required: true, 
    type: Types.ObjectId, 
    ref: 'Sponsor' 
  })
  sponsorId: Types.ObjectId;

  @Prop({ 
    required: true, 
    min: 0 
  })
  amount: number;

  @Prop({ 
    default: Date.now 
  })
  timestamp: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BidSchema = SchemaFactory.createForClass(Bid);

// Índices para optimizar consultas
BidSchema.index({ auctionId: 1 });
BidSchema.index({ clueId: 1 });
BidSchema.index({ sponsorId: 1 });
BidSchema.index({ timestamp: -1 });

// Índice compuesto para validar que un sponsor solo puje por una pista
BidSchema.index({ auctionId: 1, sponsorId: 1 }, { unique: true });