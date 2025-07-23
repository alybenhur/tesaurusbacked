import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserDocument, UserRole } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export interface AuthResponse {
    user: UserDocument;
    token: string;
    refreshToken?: string;
}
export declare class AuthService {
    private userModel;
    private jwtService;
    private configService;
    constructor(userModel: Model<UserDocument>, jwtService: JwtService, configService: ConfigService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    validateUser(email: string, password: string): Promise<UserDocument | null>;
    validateUserAlternative(email: string, password: string): Promise<UserDocument | null>;
    findById(id: string): Promise<UserDocument>;
    findByEmail(email: string): Promise<UserDocument>;
    updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument>;
    updateUserScore(userId: string, points: number): Promise<UserDocument>;
    addDiscoveredClue(userId: string, clueId: string): Promise<UserDocument>;
    logout(userId: string): Promise<void>;
    refreshTokens(userId: string, refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private generateTokens;
    getAllUsers(): Promise<UserDocument[]>;
    getUsersByRole(role: UserRole): Promise<UserDocument[]>;
    deactivateUser(id: string): Promise<UserDocument>;
    reactivateUser(id: string): Promise<UserDocument>;
}
