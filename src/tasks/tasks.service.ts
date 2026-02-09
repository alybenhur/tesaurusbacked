import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GamesService } from '../games/games.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly gamesService: GamesService) {}

  /**
   * Cron job que se ejecuta cada 5 minutos para limpiar
   * los collaborative attempts expirados
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'cleanup-expired-attempts',
    timeZone: 'America/Bogota', // Ajusta según tu zona horaria
  })
  async handleExpiredCollaborativeAttempts(): Promise<void> {
    this.logger.log('🧹 Iniciando limpieza de collaborative attempts expirados...');
    
    try {
      const startTime = Date.now();
      
      // Llamar al método de limpieza del games service
      const cleanupResult = await this.gamesService.cleanupExpiredCollaborativeAttempts();
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      if (cleanupResult && cleanupResult.deletedCount > 0) {
        this.logger.log(
          `✅ Limpieza completada exitosamente: ${cleanupResult.deletedCount} registros eliminados en ${executionTime}ms`
        );
      } else {
        this.logger.log(
          `ℹ️ Limpieza completada: No se encontraron registros expirados (${executionTime}ms)`
        );
      }
      
    } catch (error) {
      this.logger.error(
        '❌ Error durante la limpieza de collaborative attempts expirados:',
        error.stack
      );
      
      // Opcional: Aquí podrías enviar una notificación o alerta
      // await this.sendErrorNotification(error);
    }
  }

  /**
   * Método manual para ejecutar la limpieza (útil para testing o administración)
   */
  async manualCleanup(): Promise<any> {
    this.logger.log('🔧 Ejecutando limpieza manual de collaborative attempts expirados...');
    
    try {
      const result = await this.gamesService.cleanupExpiredCollaborativeAttempts();
      this.logger.log(`✅ Limpieza manual completada: ${result?.deletedCount || 0} registros procesados`);
      return result;
    } catch (error) {
      this.logger.error('❌ Error en limpieza manual:', error.stack);
      throw error;
    }
  }

  /**
   * Método para obtener estadísticas de los cron jobs
   */
  getCleanupStats(): any {
    return {
      jobName: 'cleanup-expired-attempts',
      schedule: 'Every 5 minutes',
      cronExpression: CronExpression.EVERY_5_MINUTES,
      timeZone: 'America/Bogota',
      status: 'active'
    };
  }

  /**
   * Método opcional para enviar notificaciones de error
   * Puedes implementar integración con Slack, email, etc.
   */
  private async sendErrorNotification(error: Error): Promise<void> {
    // Implementar según tus necesidades
    // Ejemplo: envío a Slack, email, sistema de monitoreo, etc.
    this.logger.warn('⚠️ Considera implementar notificaciones de error para producción');
  }
}