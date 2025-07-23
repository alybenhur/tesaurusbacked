"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CluesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const clues_service_1 = require("./clues.service");
const clues_controller_1 = require("./clues.controller");
const clue_schema_1 = require("./schemas/clue.schema");
let CluesModule = class CluesModule {
};
exports.CluesModule = CluesModule;
exports.CluesModule = CluesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: clue_schema_1.Clue.name, schema: clue_schema_1.ClueSchema }
            ])
        ],
        controllers: [clues_controller_1.CluesController],
        providers: [clues_service_1.CluesService],
        exports: [clues_service_1.CluesService]
    })
], CluesModule);
//# sourceMappingURL=clues.module.js.map