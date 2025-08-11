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

export interface AuthResponse {
  user: UserDocument;
  token: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
     private sponsorService: SponsorService
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
}