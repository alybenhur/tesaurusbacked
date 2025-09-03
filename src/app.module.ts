import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer'; // 👈 Agregar esta importación
import { GamesModule } from './games/games.module';
import { CluesModule } from './clues/clues.module';
import { PlayersModule } from './players/players.module';
import { AuthModule } from './auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { SponsorModule } from './sponsor/sponsor.module';
import { GamesponsorModule } from './gamesponsor/gamesponsor.module';
import { AuctionModule } from './pujas/pujas.module';
import { EmailModule } from './email/email.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 60000,
      limit: 10,
    }, {
      name: 'medium',
      ttl: 600000,
      limit: 50,
    }, {
      name: 'long',
      ttl: 3600000,
      limit: 100,
    }]),

    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // 👈 Agregar configuración del MailerModule
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        console.log('📧 Configurando SMTP...');
        console.log('SMTP Host:', configService.get('SMTP_HOST'));
        console.log('SMTP Port:', configService.get('SMTP_PORT'));
        console.log('SMTP User:', configService.get('SMTP_USER'));
        
        return {
          transport: {
            host: configService.get('SMTP_HOST') || 'smtp.gmail.com',
            port: parseInt(configService.get('SMTP_PORT')) || 465,
            secure: configService.get('SMTP_SECURE') === 'true' || true,
            auth: {
              user: configService.get('SMTP_USER'),
              pass: configService.get('SMTP_PASS'),
            },
            tls: {
              rejectUnauthorized: false
            },
            // Para debug
            debug: true,
            logger: true,
          },
          defaults: {
            from: `"Treasure Hunter" <${configService.get('SMTP_USER')}>`,
          },
        };
      },
      inject: [ConfigService],
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
    SponsorModule,
    GamesponsorModule,
    AuctionModule,
    EmailModule,
  ],
  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  }],
})
export class AppModule {}