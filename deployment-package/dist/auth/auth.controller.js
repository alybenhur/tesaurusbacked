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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const register_dto_1 = require("./dto/register.dto");
const login_dto_1 = require("./dto/login.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const roles_guard_1 = require("./guards/roles.guard");
const roles_decorator_1 = require("./decorators/roles.decorator");
const current_user_decorator_1 = require("./decorators/current-user.decorator");
const user_schema_1 = require("./schemas/user.schema");
const class_transformer_1 = require("class-transformer");
const login_response_dto_1 = require("./dto/login-response.dto");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async register(registerDto) {
        const result = await this.authService.register(registerDto);
        return {
            message: 'Usuario registrado exitosamente',
            user: result.user,
            token: result.token,
            refreshToken: result.refreshToken,
        };
    }
    async login(loginDto) {
        const result = await this.authService.login(loginDto);
        const userResponse = (0, class_transformer_1.plainToClass)(login_response_dto_1.LoginResponseDto, result.user, {
            excludeExtraneousValues: true,
        });
        return {
            user: {
                _id: result.user._id.toString(),
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                isActive: result.user.isActive,
                lastLogin: result.user.lastLogin?.toISOString(),
                discoveredClues: result.user.discoveredClues || [],
                totalScore: result.user.totalScore || 0,
                createdAt: result.user.createdAt?.toISOString(),
                updatedAt: result.user.updatedAt?.toISOString(),
            },
            token: result.token,
            refreshToken: result.refreshToken,
        };
    }
    async getProfile(user) {
        return {
            message: 'Perfil obtenido exitosamente',
            user,
        };
    }
    async updateProfile(user, updateUserDto) {
        const updatedUser = await this.authService.updateUser(user._id.toString(), updateUserDto);
        return {
            message: 'Perfil actualizado exitosamente',
            user: updatedUser,
        };
    }
    async logout(user) {
        await this.authService.logout(user._id.toString());
        return {
            message: 'Logout exitoso',
        };
    }
    async refreshTokens(body) {
        const tokens = await this.authService.refreshTokens(body.userId, body.refreshToken);
        return {
            message: 'Tokens renovados exitosamente',
            ...tokens,
        };
    }
    async getAllUsers() {
        const users = await this.authService.getAllUsers();
        return {
            message: 'Usuarios obtenidos exitosamente',
            users,
            count: users.length,
        };
    }
    async getUsersByRole(role) {
        const users = await this.authService.getUsersByRole(role);
        return {
            message: `Usuarios con rol ${role} obtenidos exitosamente`,
            users,
            count: users.length,
        };
    }
    async getUserById(id) {
        const user = await this.authService.findById(id);
        return {
            message: 'Usuario obtenido exitosamente',
            user,
        };
    }
    async updateUser(id, updateUserDto) {
        const user = await this.authService.updateUser(id, updateUserDto);
        return {
            message: 'Usuario actualizado exitosamente',
            user,
        };
    }
    async deactivateUser(id) {
        const user = await this.authService.deactivateUser(id);
        return {
            message: 'Usuario desactivado exitosamente',
            user,
        };
    }
    async reactivateUser(id) {
        const user = await this.authService.reactivateUser(id);
        return {
            message: 'Usuario reactivado exitosamente',
            user,
        };
    }
    async addDiscoveredClue(userId, clueId) {
        const user = await this.authService.addDiscoveredClue(userId, clueId);
        return {
            message: 'Pista agregada exitosamente',
            user,
        };
    }
    async addScore(userId, body) {
        const user = await this.authService.updateUserScore(userId, body.points);
        return {
            message: 'Puntuación actualizada exitosamente',
            user,
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Put)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refreshTokens", null);
__decorate([
    (0, common_1.Get)('users'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getAllUsers", null);
__decorate([
    (0, common_1.Get)('users/role/:role'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.ADMIN, user_schema_1.UserRole.MODERATOR),
    __param(0, (0, common_1.Param)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getUsersByRole", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getUserById", null);
__decorate([
    (0, common_1.Put)('users/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Delete)('users/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deactivateUser", null);
__decorate([
    (0, common_1.Post)('users/:id/reactivate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "reactivateUser", null);
__decorate([
    (0, common_1.Post)('users/:id/add-clue/:clueId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('clueId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "addDiscoveredClue", null);
__decorate([
    (0, common_1.Post)('users/:id/add-score'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "addScore", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map