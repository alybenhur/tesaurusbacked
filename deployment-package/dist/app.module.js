"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const games_module_1 = require("./games/games.module");
const clues_module_1 = require("./clues/clues.module");
const players_module_1 = require("./players/players.module");
const websockets_module_1 = require("./websockets/websockets.module");
const auth_module_1 = require("./auth/auth.module");
const schedule_1 = require("@nestjs/schedule");
const tasks_module_1 = require("./tasks/tasks.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => {
                    const uri = configService.get('MONGODB_URI');
                    console.log('🔗 Conectando a MongoDB:', uri ? 'URI configurada' : 'URI no encontrada');
                    return {
                        uri: uri || 'mongodb://localhost:27017/treasure-hunt-monteria',
                        useNewUrlParser: true,
                        useUnifiedTopology: true,
                    };
                },
                inject: [config_1.ConfigService],
            }),
            games_module_1.GamesModule,
            clues_module_1.CluesModule,
            players_module_1.PlayersModule,
            websockets_module_1.WebsocketsModule,
            auth_module_1.AuthModule,
            tasks_module_1.TasksModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map