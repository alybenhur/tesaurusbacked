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
}