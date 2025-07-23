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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborativeAttemptSchema = exports.CollaborativeAttempt = exports.CollaborativeAttemptStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var CollaborativeAttemptStatus;
(function (CollaborativeAttemptStatus) {
    CollaborativeAttemptStatus["ACTIVE"] = "active";
    CollaborativeAttemptStatus["COMPLETED"] = "completed";
    CollaborativeAttemptStatus["EXPIRED"] = "expired";
})(CollaborativeAttemptStatus || (exports.CollaborativeAttemptStatus = CollaborativeAttemptStatus = {}));
let CollaborativeAttempt = class CollaborativeAttempt {
};
exports.CollaborativeAttempt = CollaborativeAttempt;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'Clue', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CollaborativeAttempt.prototype, "clueId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'Game', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CollaborativeAttempt.prototype, "gameId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], CollaborativeAttempt.prototype, "participantIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 2, max: 20 }),
    __metadata("design:type", Number)
], CollaborativeAttempt.prototype, "requiredPlayers", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], CollaborativeAttempt.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", Date)
], CollaborativeAttempt.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: CollaborativeAttemptStatus,
        default: CollaborativeAttemptStatus.ACTIVE,
        index: true
    }),
    __metadata("design:type", String)
], CollaborativeAttempt.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CollaborativeAttempt.prototype, "initiatedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], CollaborativeAttempt.prototype, "completedAt", void 0);
exports.CollaborativeAttempt = CollaborativeAttempt = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], CollaborativeAttempt);
exports.CollaborativeAttemptSchema = mongoose_1.SchemaFactory.createForClass(CollaborativeAttempt);
exports.CollaborativeAttemptSchema.index({ clueId: 1, status: 1 });
exports.CollaborativeAttemptSchema.index({ gameId: 1, status: 1 });
exports.CollaborativeAttemptSchema.index({ expiresAt: 1, status: 1 });
//# sourceMappingURL=collaborative-attempt.schema.js.map