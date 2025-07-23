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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CollaborativeCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborativeCleanupService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const collaborative_attempt_schema_1 = require("../games/schemas/collaborative-attempt.schema");
let CollaborativeCleanupService = CollaborativeCleanupService_1 = class CollaborativeCleanupService {
    constructor(collaborativeAttemptModel) {
        this.collaborativeAttemptModel = collaborativeAttemptModel;
        this.logger = new common_1.Logger(CollaborativeCleanupService_1.name);
    }
    async cleanupExpiredAttempts() {
        try {
            const now = new Date();
            const expiredResult = await this.collaborativeAttemptModel.updateMany({
                status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE,
                expiresAt: { $lt: now }
            }, {
                $set: { status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.EXPIRED }
            }).exec();
            if (expiredResult.modifiedCount > 0) {
                this.logger.log(`Marcados ${expiredResult.modifiedCount} intentos colaborativos como expirados`);
            }
            const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const deleteResult = await this.collaborativeAttemptModel.deleteMany({
                status: { $in: [collaborative_attempt_schema_1.CollaborativeAttemptStatus.EXPIRED, collaborative_attempt_schema_1.CollaborativeAttemptStatus.COMPLETED] },
                updatedAt: { $lt: yesterdayDate }
            }).exec();
            if (deleteResult.deletedCount > 0) {
                this.logger.log(`Eliminados ${deleteResult.deletedCount} intentos colaborativos antiguos`);
            }
        }
        catch (error) {
            this.logger.error(`Error en limpieza de intentos colaborativos: ${error.message}`, error.stack);
        }
    }
    async runCleanup() {
        const now = new Date();
        const expiredResult = await this.collaborativeAttemptModel.updateMany({
            status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE,
            expiresAt: { $lt: now }
        }, {
            $set: { status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.EXPIRED }
        }).exec();
        const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const deleteResult = await this.collaborativeAttemptModel.deleteMany({
            status: { $in: [collaborative_attempt_schema_1.CollaborativeAttemptStatus.EXPIRED, collaborative_attempt_schema_1.CollaborativeAttemptStatus.COMPLETED] },
            updatedAt: { $lt: yesterdayDate }
        }).exec();
        return {
            expired: expiredResult.modifiedCount,
            deleted: deleteResult.deletedCount
        };
    }
    async getStats() {
        const [active, completed, expired, total] = await Promise.all([
            this.collaborativeAttemptModel.countDocuments({ status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.ACTIVE }).exec(),
            this.collaborativeAttemptModel.countDocuments({ status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.COMPLETED }).exec(),
            this.collaborativeAttemptModel.countDocuments({ status: collaborative_attempt_schema_1.CollaborativeAttemptStatus.EXPIRED }).exec(),
            this.collaborativeAttemptModel.countDocuments({}).exec(),
        ]);
        return { active, completed, expired, total };
    }
};
exports.CollaborativeCleanupService = CollaborativeCleanupService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CollaborativeCleanupService.prototype, "cleanupExpiredAttempts", null);
exports.CollaborativeCleanupService = CollaborativeCleanupService = CollaborativeCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(collaborative_attempt_schema_1.CollaborativeAttempt.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], CollaborativeCleanupService);
//# sourceMappingURL=collaborative-cleanup.service.js.map