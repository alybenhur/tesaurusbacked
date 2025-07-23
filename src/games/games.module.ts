import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { Game, GameSchema } from './schemas/game.schema';
import { Clue, ClueSchema } from '../clues/schemas/clue.schema';
import { PlayerProgress, PlayerProgressSchema } from './schemas/player-progress.schema';
import { CollaborativeAttempt, CollaborativeAttemptSchema } from './schemas/collaborative-attempt.schema';
import { PlayerAchievement, PlayerAchievementSchema } from './schemas/player-achievement.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Game.name, schema: GameSchema },
      { name: Clue.name, schema: ClueSchema },
      { name: PlayerProgress.name, schema: PlayerProgressSchema },
      { name: CollaborativeAttempt.name, schema: CollaborativeAttemptSchema },
      { name: PlayerAchievement.name, schema: PlayerAchievementSchema } // ✅ NUEVO
    ]),
  ],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService], // Para usar en otros módulos si es necesario
})
export class GamesModule {}