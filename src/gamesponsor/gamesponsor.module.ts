import { Module } from '@nestjs/common';
import { GameSponsorAssociationService } from './gamesponsor.service';
import { GameSponsorController } from './gamesponsor.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { GameSponsorAssociation, GameSponsorAssociationSchema } from './schemas/gamesponsor.schema';
import { Clue, ClueSchema } from 'src/clues/schemas/clue.schema';
import { Game, GameSchema } from 'src/games/schemas/game.schema';
import { GamesModule } from 'src/games/games.module';
import { CluesModule } from 'src/clues/clues.module';


@Module({
   imports: [
   MongooseModule.forFeature([
      { name: GameSponsorAssociation.name, schema: GameSponsorAssociationSchema },
      { name: Clue.name, schema: ClueSchema },
      { name: Game.name, schema: GameSchema }
    ]),
    // Importar módulos que contienen servicios necesarios
    GamesModule,
    CluesModule,
   ],
  controllers: [GameSponsorController],
  providers: [GameSponsorAssociationService],
 
})
export class GamesponsorModule {}
