import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GamesModule } from './games/games.module';
import { CluesModule } from './clues/clues.module';
import { PlayersModule } from './players/players.module';
import { AuthModule } from './auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';


@Module({
  imports: [
    // Configuración de variables de entorno
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Configuración de MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        console.log('🔗 Conectando a MongoDB:', uri ? 'URI configurada' : 'URI no encontrada');
        
        return {
          uri: uri || 'mongodb://localhost:27017/treasure-hunt-monteria',
          useNewUrlParser: true,
          useUnifiedTopology: true,
        };
      },
      inject: [ConfigService],
    }),
    
    // Módulos de la aplicación
    GamesModule,
    CluesModule,
    PlayersModule,
    AuthModule,
    TasksModule,
   
  ],
})
export class AppModule {}