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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = require("bcryptjs");
const user_schema_1 = require("./schemas/user.schema");
let AuthService = class AuthService {
    constructor(userModel, jwtService, configService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(registerDto) {
        const { email, password, name, role = user_schema_1.UserRole.PLAYER } = registerDto;
        const existingUser = await this.userModel.findOne({ email }).exec();
        if (existingUser) {
            throw new common_1.ConflictException('El usuario con este email ya existe');
        }
        const user = new this.userModel({
            name,
            email,
            password,
            role,
            lastLogin: new Date(),
        });
        await user.save();
        const tokens = await this.generateTokens(user);
        user.refreshToken = tokens.refreshToken;
        await user.save();
        return {
            user,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    async login(loginDto) {
        const { email, password } = loginDto;
        const user = await this.validateUser(email, password);
        if (!user) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        user.lastLogin = new Date();
        await user.save();
        const tokens = await this.generateTokens(user);
        user.refreshToken = tokens.refreshToken;
        await user.save();
        return {
            user,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    async validateUser(email, password) {
        const user = await this.userModel.findOne({ email, isActive: true }).exec();
        if (user) {
            const isPasswordValid = await user.comparePassword(password);
            if (isPasswordValid) {
                return user;
            }
        }
        return null;
    }
    async validateUserAlternative(email, password) {
        const user = await this.userModel.findOne({ email, isActive: true }).exec();
        if (user) {
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (isPasswordValid) {
                return user;
            }
        }
        return null;
    }
    async findById(id) {
        const user = await this.userModel.findById(id).exec();
        if (!user || !user.isActive) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        return user;
    }
    async findByEmail(email) {
        const user = await this.userModel.findOne({ email, isActive: true }).exec();
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        return user;
    }
    async updateUser(id, updateUserDto) {
        const user = await this.findById(id);
        Object.assign(user, updateUserDto);
        return user.save();
    }
    async updateUserScore(userId, points) {
        const user = await this.findById(userId);
        user.totalScore += points;
        return user.save();
    }
    async addDiscoveredClue(userId, clueId) {
        const user = await this.findById(userId);
        if (!user.discoveredClues.includes(clueId)) {
            user.discoveredClues.push(clueId);
            await user.save();
        }
        return user;
    }
    async logout(userId) {
        await this.userModel.findByIdAndUpdate(userId, { refreshToken: null }).exec();
    }
    async refreshTokens(userId, refreshToken) {
        const user = await this.findById(userId);
        if (!user.refreshToken || user.refreshToken !== refreshToken) {
            throw new common_1.UnauthorizedException('Token de refresh inválido');
        }
        const tokens = await this.generateTokens(user);
        user.refreshToken = tokens.refreshToken;
        await user.save();
        return tokens;
    }
    async generateTokens(user) {
        const payload = {
            sub: user._id.toString(),
            email: user.email,
            role: user.role,
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_SECRET'),
                expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
            }),
        ]);
        return { accessToken, refreshToken };
    }
    async getAllUsers() {
        return this.userModel.find({ isActive: true }).sort({ createdAt: -1 }).exec();
    }
    async getUsersByRole(role) {
        return this.userModel.find({ role, isActive: true }).exec();
    }
    async deactivateUser(id) {
        const user = await this.findById(id);
        user.isActive = false;
        user.refreshToken = null;
        return user.save();
    }
    async reactivateUser(id) {
        const user = await this.userModel.findById(id).exec();
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        user.isActive = true;
        return user.save();
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map