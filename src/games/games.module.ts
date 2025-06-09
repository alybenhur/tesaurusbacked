import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { Game, GameSchema } from './schemas/game.schema';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
    forwardRef(() => WebsocketsModule), // Importar el módulo de WebSockets
  ],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService], // Exportar para uso en otros módulos
})
export class GamesModule {}