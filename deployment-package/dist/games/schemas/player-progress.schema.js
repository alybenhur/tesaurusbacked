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
exports.PlayerProgressSchema = exports.PlayerProgress = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const clue_schema_1 = require("../../clues/schemas/clue.schema");
let PlayerProgress = class PlayerProgress {
};
exports.PlayerProgress = PlayerProgress;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'Game' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PlayerProgress.prototype, "gameId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], PlayerProgress.prototype, "playerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{
                clueId: { type: mongoose_2.Types.ObjectId, ref: 'Clue' },
                status: { type: String, enum: clue_schema_1.ClueStatus, default: clue_schema_1.ClueStatus.HIDDEN },
                discoveredAt: { type: Date }
            }], default: [] }),
    __metadata("design:type", Array)
], PlayerProgress.prototype, "clues", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], PlayerProgress.prototype, "totalPoints", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], PlayerProgress.prototype, "lastActivity", void 0);
exports.PlayerProgress = PlayerProgress = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], PlayerProgress);
exports.PlayerProgressSchema = mongoose_1.SchemaFactory.createForClass(PlayerProgress);
//# sourceMappingURL=player-progress.schema.js.map