import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuctionController } from './pujas.controller';
import { AuctionService } from './pujas.service';
import { Auction, AuctionSchema } from './schemas/auction.schema';
import { Bid, BidSchema } from './schemas/bid.schema';

// Importar los schemas de otros módulos que necesitamos
import { Game, GameSchema } from '../games/schemas/game.schema';
import { Clue, ClueSchema } from '../clues/schemas/clue.schema';
import { Sponsor, SponsorSchema } from '../sponsor/schemas/sponsor.schema';
import { GameSponsorAssociation, GameSponsorAssociationSchema } from '../gamesponsor/schemas/gamesponsor.schema';
import { User, UserSchema } from 'src/auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Auction.name, schema: AuctionSchema },
      { name: Bid.name, schema: BidSchema },
      { name: Game.name, schema: GameSchema },
      { name: Clue.name, schema: ClueSchema },
      { name: Sponsor.name, schema: SponsorSchema },
      { name: User.name, schema: UserSchema },
      { name: GameSponsorAssociation.name, schema: GameSponsorAssociationSchema }
    ])
  ],
  controllers: [AuctionController],
  providers: [AuctionService],
  exports: [AuctionService]
})
export class AuctionModule {}