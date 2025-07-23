"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const games_service_1 = require("./games.service");
const games_controller_1 = require("./games.controller");
const game_schema_1 = require("./schemas/game.schema");
const clue_schema_1 = require("../clues/schemas/clue.schema");
const player_progress_schema_1 = require("./schemas/player-progress.schema");
const collaborative_attempt_schema_1 = require("./schemas/collaborative-attempt.schema");
const player_achievement_schema_1 = require("./schemas/player-achievement.schema");
let GamesModule = class GamesModule {
};
exports.GamesModule = GamesModule;
exports.GamesModule = GamesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: game_schema_1.Game.name, schema: game_schema_1.GameSchema },
                { name: clue_schema_1.Clue.name, schema: clue_schema_1.ClueSchema },
                { name: player_progress_schema_1.PlayerProgress.name, schema: player_progress_schema_1.PlayerProgressSchema },
                { name: collaborative_attempt_schema_1.CollaborativeAttempt.name, schema: collaborative_attempt_schema_1.CollaborativeAttemptSchema },
                { name: player_achievement_schema_1.PlayerAchievement.name, schema: player_achievement_schema_1.PlayerAchievementSchema }
            ]),
        ],
        controllers: [games_controller_1.GamesController],
        providers: [games_service_1.GamesService],
        exports: [games_service_1.GamesService],
    })
], GamesModule);
//# sourceMappingURL=games.module.js.map