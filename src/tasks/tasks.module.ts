import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [
    GamesModule, // Importamos el módulo de games para acceder al GamesService
  ],
  providers: [TasksService],
  exports: [TasksService], // Exportamos por si necesitamos usar el servicio en otros módulos
})
export class TasksModule {}