"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TasksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const games_service_1 = require("../games/games.service");
let TasksService = TasksService_1 = class TasksService {
    constructor(gamesService) {
        this.gamesService = gamesService;
        this.logger = new common_1.Logger(TasksService_1.name);
    }
    async handleExpiredCollaborativeAttempts() {
        this.logger.log('🧹 Iniciando limpieza de collaborative attempts expirados...');
        try {
            const startTime = Date.now();
            const cleanupResult = await this.gamesService.cleanupExpiredCollaborativeAttempts();
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            if (cleanupResult && cleanupResult.deletedCount > 0) {
                this.logger.log(`✅ Limpieza completada exitosamente: ${cleanupResult.deletedCount} registros eliminados en ${executionTime}ms`);
            }
            else {
                this.logger.log(`ℹ️ Limpieza completada: No se encontraron registros expirados (${executionTime}ms)`);
            }
        }
        catch (error) {
            this.logger.error('❌ Error durante la limpieza de collaborative attempts expirados:', error.stack);
        }
    }
    async manualCleanup() {
        this.logger.log('🔧 Ejecutando limpieza manual de collaborative attempts expirados...');
        try {
            const result = await this.gamesService.cleanupExpiredCollaborativeAttempts();
            this.logger.log(`✅ Limpieza manual completada: ${result?.deletedCount || 0} registros procesados`);
            return result;
        }
        catch (error) {
            this.logger.error('❌ Error en limpieza manual:', error.stack);
            throw error;
        }
    }
    getCleanupStats() {
        return {
            jobName: 'cleanup-expired-attempts',
            schedule: 'Every 5 minutes',
            cronExpression: schedule_1.CronExpression.EVERY_5_MINUTES,
            timeZone: 'America/Bogota',
            status: 'active'
        };
    }
    async sendErrorNotification(error) {
        this.logger.warn('⚠️ Considera implementar notificaciones de error para producción');
    }
};
exports.TasksService = TasksService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES, {
        name: 'cleanup-expired-attempts',
        timeZone: 'America/Bogota',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "handleExpiredCollaborativeAttempts", null);
exports.TasksService = TasksService = TasksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [games_service_1.GamesService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map