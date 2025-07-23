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
exports.PlayerAchievementSchema = exports.PlayerAchievement = exports.AchievementType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var AchievementType;
(function (AchievementType) {
    AchievementType["GAME_WIN"] = "game_win";
    AchievementType["GAME_PARTICIPATION"] = "game_participation";
    AchievementType["FIRST_CLUE"] = "first_clue";
    AchievementType["SPEED_RUN"] = "speed_run";
    AchievementType["COLLABORATIVE_MASTER"] = "collaborative_master";
})(AchievementType || (exports.AchievementType = AchievementType = {}));
let PlayerAchievement = class PlayerAchievement {
};
exports.PlayerAchievement = PlayerAchievement;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], PlayerAchievement.prototype, "playerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'Game', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PlayerAchievement.prototype, "gameId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        type: String,
        enum: AchievementType,
        default: AchievementType.GAME_WIN,
        index: true
    }),
    __metadata("design:type", String)
], PlayerAchievement.prototype, "achievementType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", Date)
], PlayerAchievement.prototype, "completedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            name: { type: String, required: true },
            description: { type: String, required: true },
            totalClues: { type: Number, required: true },
            startedAt: { type: Date, required: true },
            completionTimeMinutes: { type: Number, required: true },
            playerStats: {
                cluesDiscovered: { type: Number, required: true },
                collaborativeCluesParticipated: { type: Number, required: true },
                totalParticipants: { type: Number, required: true }
            }
        },
        _id: false
    }),
    __metadata("design:type", Object)
], PlayerAchievement.prototype, "gameDetails", void 0);
exports.PlayerAchievement = PlayerAchievement = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], PlayerAchievement);
exports.PlayerAchievementSchema = mongoose_1.SchemaFactory.createForClass(PlayerAchievement);
exports.PlayerAchievementSchema.index({ playerId: 1, achievementType: 1 });
exports.PlayerAchievementSchema.index({ playerId: 1, completedAt: -1 });
exports.PlayerAchievementSchema.index({ achievementType: 1, completedAt: -1 });
//# sourceMappingURL=player-achievement.schema.js.map