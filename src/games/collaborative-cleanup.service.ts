import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CollaborativeAttempt, CollaborativeAttemptDocument, CollaborativeAttemptStatus } from '../games/schemas/collaborative-attempt.schema';

@Injectable()
export class CollaborativeCleanupService {
  private readonly logger = new Logger(CollaborativeCleanupService.name);

  constructor(
    @InjectModel(CollaborativeAttempt.name) 
    private collaborativeAttemptModel: Model<CollaborativeAttemptDocument>,
  ) {}

  // ✅ Ejecutar cada 5 minutos para limpiar intentos expirados
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredAttempts(): Promise<void> {
    try {
      const now = new Date();
      
      // Marcar intentos expirados
      const expiredResult = await this.collaborativeAttemptModel.updateMany(
        {
          status: CollaborativeAttemptStatus.ACTIVE,
          expiresAt: { $lt: now }
        },
        {
          $set: { status: CollaborativeAttemptStatus.EXPIRED }
        }
      ).exec();

      if (expiredResult.modifiedCount > 0) {
        this.logger.log(`Marcados ${expiredResult.modifiedCount} intentos colaborativos como expirados`);
      }

      // Opcional: Eliminar intentos expirados antiguos (más de 24 horas)
      const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const deleteResult = await this.collaborativeAttemptModel.deleteMany({
        status: { $in: [CollaborativeAttemptStatus.EXPIRED, CollaborativeAttemptStatus.COMPLETED] },
        updatedAt: { $lt: yesterdayDate }
      }).exec();

      if (deleteResult.deletedCount > 0) {
        this.logger.log(`Eliminados ${deleteResult.deletedCount} intentos colaborativos antiguos`);
      }

    } catch (error) {
      this.logger.error(`Error en limpieza de intentos colaborativos: ${error.message}`, error.stack);
    }
  }

  // ✅ Método manual para ejecutar limpieza
  async runCleanup(): Promise<{ expired: number; deleted: number }> {
    const now = new Date();
    
    // Marcar como expirados
    const expiredResult = await this.collaborativeAttemptModel.updateMany(
      {
        status: CollaborativeAttemptStatus.ACTIVE,
        expiresAt: { $lt: now }
      },
      {
        $set: { status: CollaborativeAttemptStatus.EXPIRED }
      }
    ).exec();

    // Eliminar antiguos
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const deleteResult = await this.collaborativeAttemptModel.deleteMany({
      status: { $in: [CollaborativeAttemptStatus.EXPIRED, CollaborativeAttemptStatus.COMPLETED] },
      updatedAt: { $lt: yesterdayDate }
    }).exec();

    return {
      expired: expiredResult.modifiedCount,
      deleted: deleteResult.deletedCount
    };
  }

  // ✅ Obtener estadísticas de intentos colaborativos
  async getStats(): Promise<{
    active: number;
    completed: number;
    expired: number;
    total: number;
  }> {
    const [active, completed, expired, total] = await Promise.all([
      this.collaborativeAttemptModel.countDocuments({ status: CollaborativeAttemptStatus.ACTIVE }).exec(),
      this.collaborativeAttemptModel.countDocuments({ status: CollaborativeAttemptStatus.COMPLETED }).exec(),
      this.collaborativeAttemptModel.countDocuments({ status: CollaborativeAttemptStatus.EXPIRED }).exec(),
      this.collaborativeAttemptModel.countDocuments({}).exec(),
    ]);

    return { active, completed, expired, total };
  }
}