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
exports.ClueSchema = exports.Clue = exports.ClueLocation = exports.ClueStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var ClueStatus;
(function (ClueStatus) {
    ClueStatus["HIDDEN"] = "hidden";
    ClueStatus["DISCOVERED"] = "discovered";
    ClueStatus["REVEALED"] = "revealed";
})(ClueStatus || (exports.ClueStatus = ClueStatus = {}));
let ClueLocation = class ClueLocation {
};
exports.ClueLocation = ClueLocation;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], ClueLocation.prototype, "latitude", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], ClueLocation.prototype, "longitude", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ClueLocation.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ClueLocation.prototype, "description", void 0);
exports.ClueLocation = ClueLocation = __decorate([
    (0, mongoose_1.Schema)()
], ClueLocation);
let Clue = class Clue extends mongoose_2.Document {
};
exports.Clue = Clue;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Types.ObjectId, ref: 'Game' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Clue.prototype, "gameId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Clue.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Clue.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Clue.prototype, "hint", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        unique: true,
        index: true
    }),
    __metadata("design:type", String)
], Clue.prototype, "idPista", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: ClueLocation }),
    __metadata("design:type", ClueLocation)
], Clue.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Clue.prototype, "qrCode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], Clue.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Clue.prototype, "isCompleted", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ClueStatus, default: ClueStatus.HIDDEN }),
    __metadata("design:type", String)
], Clue.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Clue.prototype, "discoveredBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Clue.prototype, "discoveredAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Clue.prototype, "range", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Clue.prototype, "answer", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Clue.prototype, "imageUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Clue.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], Clue.prototype, "hints", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Clue.prototype, "pointsValue", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Clue.prototype, "timeLimit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Clue.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Clue.prototype, "isCollaborative", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: Number,
        min: 2,
        max: 20,
        validate: {
            validator: function (value) {
                return !this.isCollaborative || (value >= 2 && value <= 20);
            },
            message: 'requiredPlayers debe estar entre 2 y 20 para pistas colaborativas'
        }
    }),
    __metadata("design:type", Number)
], Clue.prototype, "requiredPlayers", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: Number,
        min: 1,
        max: 60,
        validate: {
            validator: function (value) {
                return !this.isCollaborative || (value >= 1 && value <= 60);
            },
            message: 'collaborativeTimeLimit debe estar entre 1 minuto y 60 minutos (1 hora)'
        }
    }),
    __metadata("design:type", Number)
], Clue.prototype, "collaborativeTimeLimit", void 0);
exports.Clue = Clue = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Clue);
exports.ClueSchema = mongoose_1.SchemaFactory.createForClass(Clue);
//# sourceMappingURL=clue.schema.js.map