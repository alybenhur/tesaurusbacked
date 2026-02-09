// src/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SponsorService } from 'src/sponsor/sponsor.service';
import { RegisterSponsorDto } from './dto/register-sponsor.dto';
import { LinkExistingSponsorDto } from './dto/link-existing-sponsor.dto';
import { PasswordResetToken, PasswordResetTokenDocument } from './schemas/password-reset-token.schema';
import { EmailService } from '../email/email.service';
import { 
  RequestPasswordResetDto, 
  VerifyResetTokenDto, 
  ResetPasswordDto,
  PasswordResetRequestResponseDto,
  VerifyResetTokenResponseDto,
  ResetPasswordResponseDto 
} from './dto';

export interface AuthResponse {
  user: UserDocument;
  token: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PasswordResetToken.name) private passwordResetTokenModel: Model<PasswordResetTokenDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sponsorService: SponsorService, 
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    let  { email, password, name, role = UserRole.PLAYER } = registerDto;

    // Verificar si el usuario ya existe
    const existingUser = await this.userModel.findOne({ email  }).exec();
    if (existingUser) {
      throw new ConflictException('El usuario con este email ya existe');
    }

    role = UserRole.PLAYER
    
    // Crear nuevo usuario
    const user = new this.userModel({
      name,
      email,
      password, // Se hasheará automáticamente por el middleware del schema
      role,
      lastLogin: new Date(),
    });

    await user.save();

    // Generar tokens
    const tokens = await this.generateTokens(user);
    
    // Guardar refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return {
      user,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

 async registerSponsor(registerSponsorDto: RegisterSponsorDto): Promise<AuthResponse> {
  const { name, password, correo, ...sponsorData } = registerSponsorDto;

  // Verificar si ya existe usuario con este email
  const existingUser = await this.userModel.findOne({ email: correo }).exec();
  if (existingUser) {
    throw new ConflictException('Ya existe un usuario con este email');
  }

  let createdSponsor: any = null;

  try {
    // 1. Crear sponsor
    createdSponsor = await this.sponsorService.create({
      correo,
      ...sponsorData
    });

    // 2. Crear usuario vinculado
    const user = new this.userModel({
      name,
      email: correo,
      password,
      role: UserRole.SPONSOR,
      sponsorId: new Types.ObjectId(createdSponsor._id as string),
      lastLogin: new Date(),
    });
    await user.save();

    // 3. Actualizar sponsor con userId - CONVERTIR AMBOS A STRING
    await this.sponsorService.updateUserId(
      createdSponsor._id.toString(),  // ← .toString()
      user._id.toString()             // ← .toString()
    );

    // 4. Generar tokens
    const tokens = await this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return {
      user,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };

  } catch (error) {
    // Rollback si falla
    if (createdSponsor?._id) {
      try {
        await this.sponsorService.remove(createdSponsor._id.toString()); // ← .toString()
      } catch (cleanupError) {
        console.error('Error al limpiar sponsor creado:', cleanupError);
      }
    }
    throw error;
  }
}


   async linkExistingSponsor(linkDto: LinkExistingSponsorDto): Promise<AuthResponse> {
  const { sponsorId, name, email, password } = linkDto;

  // Verificar que el sponsor existe
  const sponsor = await this.sponsorService.findOne(sponsorId);
  if (!sponsor) {
    throw new NotFoundException('Sponsor no encontrado');
  }

  // Verificar que no tiene usuario asociado
  const hasUser = await this.sponsorService.hasAssociatedUser(sponsorId);
  if (hasUser) {
    throw new ConflictException('Este sponsor ya tiene un usuario asociado');
  }

  // Verificar que no existe usuario con este email
  const existingUser = await this.userModel.findOne({ email }).exec();
  if (existingUser) {
    throw new ConflictException('Ya existe un usuario con este email');
  }

  // Crear usuario
  const user = new this.userModel({
    name,
    email,
    password,
    role: UserRole.SPONSOR,
    sponsorId: new Types.ObjectId(sponsorId),
    lastLogin: new Date(),
  });
  await user.save();

  // Actualizar sponsor con userId - CONVERTIR A STRING
  await this.sponsorService.updateUserId(
    sponsorId, 
    user._id.toString()  // ← .toString()
  );

  // Generar tokens
  const tokens = await this.generateTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return {
    user,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

  // Obtener perfil completo del sponsor
  async getSponsorProfile(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user || user.role !== UserRole.SPONSOR || !user.sponsorId) {
      throw new NotFoundException('Usuario sponsor no encontrado');
    }

    const sponsor = await this.sponsorService.findOne(user.sponsorId.toString());
    
    return {
      user,
      sponsor,
    };
  }


  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Generar tokens
    const tokens = await this.generateTokens(user);
    
    // Guardar refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return {
      user,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ✅ Método corregido
  async validateUser(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email, isActive: true }).exec();
    
    if (user) {
      // ✅ Cast explícito para que TypeScript reconozca el método
      const isPasswordValid = await (user as any).comparePassword(password);
      if (isPasswordValid) {
        return user;
      }
    }
    
    return null;
  }

  // ✅ Método alternativo usando bcrypt directamente
  async validateUserAlternative(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email, isActive: true }).exec();
    
    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        return user;
      }
    }
    
    return null;
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user || !user.isActive) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ email, isActive: true }).exec();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.findById(id);

    // Si se actualiza la contraseña, se hasheará automáticamente
    Object.assign(user, updateUserDto);
    return user.save();
  }

  async updateUserScore(userId: string, points: number): Promise<UserDocument> {
    const user = await this.findById(userId);
    user.totalScore += points;
    return user.save();
  }

  async addDiscoveredClue(userId: string, clueId: string): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (!user.discoveredClues.includes(clueId)) {
      user.discoveredClues.push(clueId);
      await user.save();
    }
    return user;
  }

  async logout(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null }).exec();
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.findById(userId);
    
    if (!user.refreshToken || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Token de refresh inválido');
    }

    const tokens = await this.generateTokens(user);
    
    // Actualizar refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return tokens;
  }

  private async generateTokens(user: UserDocument): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // Métodos administrativos
  async getAllUsers(): Promise<UserDocument[]> {
    return this.userModel.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  async getUsersByRole(role: UserRole): Promise<UserDocument[]> {
    return this.userModel.find({ role, isActive: true }).exec();
  }

  async deactivateUser(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    user.isActive = false;
    user.refreshToken = null;
    return user.save();
  }

  async reactivateUser(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    user.isActive = true;
    return user.save();
  }

  // ========================
// MÉTODOS DE PASSWORD RESET
// ========================

/**
 * Solicitar código de reset de contraseña
 */
async requestPasswordReset(requestDto: RequestPasswordResetDto): Promise<PasswordResetRequestResponseDto> {
  const { email } = requestDto;

  // 1. Verificar que el usuario existe y está activo
  const user = await this.userModel.findOne({ email: email.toLowerCase(), isActive: true }).exec();
  if (!user) {
    // Por seguridad, no revelamos si el email existe o no
    return {
      message: 'Si el email existe en nuestro sistema, recibirás un código de verificación',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Mock expiration
    };
  }

  // 2. Invalidar tokens anteriores del usuario
  await this.invalidateExistingTokens(user._id.toString());

  // 3. Generar nuevo token
  const token = (this.passwordResetTokenModel as any).generateToken();
  const expirationMinutes = this.configService.get<number>('PASSWORD_RESET_TOKEN_EXPIRY_MINUTES', 10);
  const expiresAt = (this.passwordResetTokenModel as any).calculateExpirationTime(expirationMinutes);

  // 4. Guardar token en base de datos
  const resetToken = new this.passwordResetTokenModel({
    userId: user._id,
    token,
    expiresAt,
    attempts: 0,
    isUsed: false
  });
  await resetToken.save();

  // 5. Enviar email
  const emailSent = await this.emailService.sendPasswordResetToken(email, token, expiresAt);
  
  if (!emailSent) {
    // Log del error pero no exponemos detalles al usuario
    console.error(`Failed to send password reset email to ${email}`);
    throw new Error('Error al enviar el código de verificación. Intenta nuevamente.');
  }

  return {
    message: 'Código de verificación enviado a tu email',
    expiresAt,
    attemptsRemaining: 3
  };
}

/**
 * Verificar token de reset (sin cambiar contraseña aún)
 */
async verifyResetToken(verifyDto: VerifyResetTokenDto): Promise<VerifyResetTokenResponseDto> {
  const { email, token } = verifyDto;

  // 1. Buscar usuario
  const user = await this.userModel.findOne({ email: email.toLowerCase(), isActive: true }).exec();
  if (!user) {
    throw new UnauthorizedException('Token inválido o expirado');
  }

  // 2. Buscar token válido
  const resetToken = await this.passwordResetTokenModel.findOne({
    userId: user._id,
    token: token.trim(),
    isUsed: false
  }).exec();

  if (!resetToken) {
    throw new UnauthorizedException('Token inválido o expirado');
  }

  // 3. Verificar si el token ha expirado
  if (resetToken.expiresAt < new Date()) {
    throw new UnauthorizedException('El token ha expirado. Solicita un nuevo código');
  }

  // 4. Verificar intentos
  if (resetToken.attempts >= 3) {
    throw new UnauthorizedException('Máximo número de intentos alcanzado. Solicita un nuevo código');
  }

  // 5. Incrementar intentos (aunque sea correcto, para tracking)
  await (resetToken as any).incrementAttempts();

  return {
    message: 'Token verificado correctamente. Puedes proceder a cambiar tu contraseña',
    isValid: true,
    canProceed: true,
    attemptsRemaining: 3 - resetToken.attempts
  };
}

/**
 * Cambiar contraseña usando el token verificado
 */
async resetPassword(resetDto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
  const { email, token, newPassword } = resetDto;

  // 1. Buscar usuario
  const user = await this.userModel.findOne({ email: email.toLowerCase(), isActive: true }).exec();
  if (!user) {
    throw new UnauthorizedException('Token inválido o expirado');
  }

  // 2. Buscar y validar token
  const resetToken = await this.passwordResetTokenModel.findOne({
    userId: user._id,
    token: token.trim(),
    isUsed: false
  }).exec();

  if (!resetToken) {
    throw new UnauthorizedException('Token inválido o expirado');
  }

  // 3. Verificaciones de seguridad
  if (resetToken.expiresAt < new Date()) {
    throw new UnauthorizedException('El token ha expirado. Solicita un nuevo código');
  }

  if (resetToken.attempts >= 3) {
    throw new UnauthorizedException('Máximo número de intentos alcanzado. Solicita un nuevo código');
  }

  // 4. Verificar que la nueva contraseña no sea igual a la actual
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new ConflictException('La nueva contraseña debe ser diferente a la actual');
  }

  try {
    // 5. Actualizar contraseña (se hasheará automáticamente por el middleware)
    user.password = newPassword;
    user.updatedAt = new Date();
    
    // 6. Invalidar refresh tokens existentes por seguridad
    user.refreshToken = null;
    
    await user.save();

    // 7. Marcar token como usado
    await (resetToken as any).markAsUsed();

    // 8. Invalidar todos los demás tokens del usuario
    await this.invalidateExistingTokens(user._id.toString(), resetToken._id.toString());

    return {
      message: 'Contraseña actualizada exitosamente',
      success: true
    };

  } catch (error) {
    console.error('Error updating password:', error);
    throw new Error('Error al actualizar la contraseña. Intenta nuevamente');
  }
}

/**
 * Invalidar tokens existentes de un usuario
 */
private async invalidateExistingTokens(userId: string, excludeTokenId?: string): Promise<void> {
  const query: any = { 
    userId: new Types.ObjectId(userId), 
    isUsed: false 
  };
  
  if (excludeTokenId) {
    query._id = { $ne: new Types.ObjectId(excludeTokenId) };
  }

  await this.passwordResetTokenModel.updateMany(
    query,
    { 
      $set: { 
        isUsed: true, 
        updatedAt: new Date() 
      } 
    }
  ).exec();
}

/**
 * Limpiar tokens expirados (método de mantenimiento)
 */
async cleanupExpiredTokens(): Promise<number> {
  const result = await this.passwordResetTokenModel.deleteMany({
    expiresAt: { $lt: new Date() }
  }).exec();

  return result.deletedCount || 0;
}

/**
 * Obtener estadísticas de tokens de reset (para administradores)
 */
async getPasswordResetStats(): Promise<any> {
  const [total, active, expired, used] = await Promise.all([
    this.passwordResetTokenModel.countDocuments().exec(),
    this.passwordResetTokenModel.countDocuments({ 
      isUsed: false, 
      expiresAt: { $gt: new Date() } 
    }).exec(),
    this.passwordResetTokenModel.countDocuments({ 
      expiresAt: { $lt: new Date() } 
    }).exec(),
    this.passwordResetTokenModel.countDocuments({ isUsed: true }).exec()
  ]);

  return {
    total,
    active,
    expired,
    used,
    lastCleanup: new Date()
  };
}

/**
 * Invalidar todos los tokens de reset de un usuario específico (público para admin)
 */
async invalidateUserResetTokens(userId: string): Promise<void> {
  // Verificar que el usuario existe
  const user = await this.findById(userId);
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  await this.invalidateExistingTokens(userId);
}

}