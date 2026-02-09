// src/auth/auth.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Put, 
  Param, 
  Delete,
  UseGuards, 
  HttpCode, 
  HttpStatus,
  ValidationPipe,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserDocument, UserRole } from './schemas/user.schema';
import { plainToClass } from 'class-transformer';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterSponsorDto } from './dto/register-sponsor.dto';
import {Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { 
  RequestPasswordResetDto,
  VerifyResetTokenDto,
  ResetPasswordDto,
  PasswordResetRequestResponseDto,
  VerifyResetTokenResponseDto,
  ResetPasswordResponseDto
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return {
      message: 'Usuario registrado exitosamente',
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken,
    };
  }

   @Post('register/sponsor')
  @HttpCode(HttpStatus.CREATED)
  async registerSponsor(@Body(ValidationPipe) registerSponsorDto: RegisterSponsorDto) {
    console.log(registerSponsorDto)
    const result = await this.authService.registerSponsor(registerSponsorDto);
    return {
      message: 'Sponsor registrado exitosamente',
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken,
    };
  }
  
  @Get('sponsor/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SPONSOR)
  async getSponsorProfile(@CurrentUser() user: UserDocument) {
    const profile = await this.authService.getSponsorProfile(user._id.toString());
    return {
      message: 'Perfil del sponsor obtenido exitosamente',
      ...profile,
    };
  }



 @Post('login')
  async login(@Body() loginDto: LoginDto) {
    console.log(loginDto)
    const result = await this.authService.login(loginDto);
    
    // Convertir el usuario a un formato serializable
    const userResponse = plainToClass(LoginResponseDto, result.user, {
      excludeExtraneousValues: true,
    });

    return {
      user: {
        _id: result.user._id.toString(), // Convertir ObjectId a string
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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: UserDocument) {
    return {
      message: 'Perfil obtenido exitosamente',
      user,
    };
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: UserDocument,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ) {
    const updatedUser = await this.authService.updateUser(user._id.toString(), updateUserDto);
    return {
      message: 'Perfil actualizado exitosamente',
      user: updatedUser,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: UserDocument) {
    await this.authService.logout(user._id.toString());
    return {
      message: 'Logout exitoso',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Body() body: { refreshToken: string; userId: string },
  ) {
    const tokens = await this.authService.refreshTokens(body.userId, body.refreshToken);
    return {
      message: 'Tokens renovados exitosamente',
      ...tokens,
    };
  }

  // Endpoints administrativos
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllUsers() {
    const users = await this.authService.getAllUsers();
    return {
      message: 'Usuarios obtenidos exitosamente',
      users,
      count: users.length,
    };
  }

  @Get('users/role/:role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getUsersByRole(@Param('role') role: UserRole) {
    const users = await this.authService.getUsersByRole(role);
    return {
      message: `Usuarios con rol ${role} obtenidos exitosamente`,
      users,
      count: users.length,
    };
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserById(@Param('id') id: string) {
    const user = await this.authService.findById(id);
    return {
      message: 'Usuario obtenido exitosamente',
      user,
    };
  }

  @Put('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ) {
    const user = await this.authService.updateUser(id, updateUserDto);
    return {
      message: 'Usuario actualizado exitosamente',
      user,
    };
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deactivateUser(@Param('id') id: string) {
    const user = await this.authService.deactivateUser(id);
    return {
      message: 'Usuario desactivado exitosamente',
      user,
    };
  }

  @Post('users/:id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reactivateUser(@Param('id') id: string) {
    const user = await this.authService.reactivateUser(id);
    return {
      message: 'Usuario reactivado exitosamente',
      user,
    };
  }

  @Post('users/:id/add-clue/:clueId')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.ADMIN)
  async addDiscoveredClue(
    @Param('id') userId: string,
    @Param('clueId') clueId: string,
  ) {
    const user = await this.authService.addDiscoveredClue(userId, clueId);
    return {
      message: 'Pista agregada exitosamente',
      user,
    };
  }

  @Post('users/:id/add-score')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(UserRole.PLAYER)
  async addScore(
    @Param('id') userId: string,
    @Body() body: { points: number },
  ) {
    const user = await this.authService.updateUserScore(userId, body.points);
    return {
      message: 'Puntuación actualizada exitosamente',
      user,
    };
  }

  /**
 * Solicitar código de reset de contraseña
 * Rate limited: máximo 3 solicitudes por hora por IP
 */
@Post('password-reset/request')
@HttpCode(HttpStatus.OK)
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
async requestPasswordReset(
  @Body(ValidationPipe) requestDto: RequestPasswordResetDto
): Promise<PasswordResetRequestResponseDto> {
  try {
    const result = await this.authService.requestPasswordReset(requestDto);
    return {
      message: result.message,
      expiresAt: result.expiresAt,
      attemptsRemaining: result.attemptsRemaining
    };
  } catch (error) {
    // Log del error para debugging pero respuesta genérica por seguridad
    console.error('Password reset request error:', error.message);
    
    return {
      message: 'Si el email existe en nuestro sistema, recibirás un código de verificación',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Mock expiration
    };
  }
}

/**
 * Verificar token de reset de contraseña
 * Rate limited: máximo 5 intentos por 15 minutos por IP
 */
@Post('password-reset/verify')
@HttpCode(HttpStatus.OK)
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
async verifyResetToken(
  @Body(ValidationPipe) verifyDto: VerifyResetTokenDto
): Promise<VerifyResetTokenResponseDto> {
  try {
    const result = await this.authService.verifyResetToken(verifyDto);
    return {
      message: result.message,
      isValid: result.isValid,
      canProceed: result.canProceed,
      attemptsRemaining: result.attemptsRemaining
    };
  } catch (error) {
    throw new UnauthorizedException({
      message: error.message || 'Token inválido o expirado',
      isValid: false,
      canProceed: false,
      attemptsRemaining: 0
    });
  }
}

/**
 * Cambiar contraseña con token verificado
 * Rate limited: máximo 3 intentos por 15 minutos por IP
 */
@Post('password-reset/confirm')
@HttpCode(HttpStatus.OK)
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 minutes
async resetPassword(
  @Body(ValidationPipe) resetDto: ResetPasswordDto
): Promise<ResetPasswordResponseDto> {
  try {
    const result = await this.authService.resetPassword(resetDto);
    return {
      message: result.message,
      success: result.success
    };
  } catch (error) {
    if (error instanceof ConflictException || error instanceof UnauthorizedException) {
      throw error;
    }
    
    // Error genérico para otros casos
    throw new UnauthorizedException({
      message: 'Error al cambiar la contraseña. Verifica tus datos e intenta nuevamente',
      success: false
    });
  }
}

// ========================
// ENDPOINTS ADMINISTRATIVOS (Password Reset)
// ========================

/**
 * Obtener estadísticas de tokens de reset (Solo ADMIN)
 */
@Get('admin/password-reset/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async getPasswordResetStats() {
  const stats = await this.authService.getPasswordResetStats();
  return {
    message: 'Estadísticas de password reset obtenidas exitosamente',
    stats
  };
}

/**
 * Limpiar tokens expirados manualmente (Solo ADMIN)
 */
@Post('admin/password-reset/cleanup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@HttpCode(HttpStatus.OK)
async cleanupExpiredTokens() {
  const deletedCount = await this.authService.cleanupExpiredTokens();
  return {
    message: `${deletedCount} tokens expirados eliminados exitosamente`,
    deletedCount
  };
}

/**
 * Invalidar todos los tokens de reset de un usuario específico (Solo ADMIN)
 */
@Post('admin/users/:userId/invalidate-reset-tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@HttpCode(HttpStatus.OK)
async invalidateUserResetTokens(@Param('userId') userId: string) {
  try {
    // Llamar método privado a través del service (necesitaremos hacerlo público)
    await this.authService.invalidateUserResetTokens(userId);
    return {
      message: 'Todos los tokens de reset del usuario han sido invalidados',
      userId
    };
  } catch (error) {
    throw new NotFoundException('Usuario no encontrado o error al invalidar tokens');
  }
}

// ========================
// ENDPOINT DE HEALTH CHECK
// ========================

/**
 * Verificar estado del servicio de email
 */
@Get('password-reset/health')
@HttpCode(HttpStatus.OK)
async checkPasswordResetHealth() {
  // Este endpoint puede ser útil para monitoreo
  return {
    message: 'Servicio de password reset disponible',
    timestamp: new Date().toISOString(),
    features: {
      emailService: true,
      tokenValidation: true,
      rateLimit: true,
      cleanup: true
    }
  };
}
}