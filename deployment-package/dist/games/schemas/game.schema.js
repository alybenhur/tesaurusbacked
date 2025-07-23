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
exports.GameSchema = exports.Game = exports.GameStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var GameStatus;
(function (GameStatus) {
    GameStatus["WAITING"] = "waiting";
    GameStatus["ACTIVE"] = "active";
    GameStatus["COMPLETED"] = "completed";
    GameStatus["CANCELLED"] = "cancelled";
})(GameStatus || (exports.GameStatus = GameStatus = {}));
let Game = class Game {
};
exports.Game = Game;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Game.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Game.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Game.prototype, "adminId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: GameStatus,
        default: GameStatus.WAITING
    }),
    __metadata("design:type", String)
], Game.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Game.prototype, "playerIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Clue' }] }),
    __metadata("design:type", Array)
], Game.prototype, "clues", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Game.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], Game.prototype, "finishedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: false }),
    __metadata("design:type", String)
], Game.prototype, "winnerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 8, min: 2, max: 20 }),
    __metadata("design:type", Number)
], Game.prototype, "maxPlayers", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 600000 }),
    __metadata("design:type", Number)
], Game.prototype, "revealDelayMs", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            center: {
                latitude: { type: Number, default: 8.7574 },
                longitude: { type: Number, default: -75.8814 }
            },
            bounds: {
                northEast: {
                    latitude: { type: Number, default: 8.7800 },
                    longitude: { type: Number, default: -75.8600 }
                },
                southWest: {
                    latitude: { type: Number, default: 8.7300 },
                    longitude: { type: Number, default: -75.9000 }
                }
            }
        },
        _id: false
    }),
    __metadata("design:type", Object)
], Game.prototype, "gameArea", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            totalClues: { type: Number, default: 0 },
            completedClues: { type: Number, default: 0 },
            lastActivity: { type: Date, default: Date.now }
        },
        _id: false
    }),
    __metadata("design:type", Object)
], Game.prototype, "metadata", void 0);
exports.Game = Game = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'games'
    })
], Game);
exports.GameSchema = mongoose_1.SchemaFactory.createForClass(Game);
//# sourceMappingURL=game.schema.js.map