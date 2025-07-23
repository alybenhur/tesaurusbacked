import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDocument, UserRole } from './schemas/user.schema';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        message: string;
        user: UserDocument;
        token: string;
        refreshToken: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        user: {
            _id: string;
            name: string;
            email: string;
            role: UserRole;
            isActive: boolean;
            lastLogin: string;
            discoveredClues: string[];
            totalScore: number;
            createdAt: string;
            updatedAt: string;
        };
        token: string;
        refreshToken: string;
    }>;
    getProfile(user: UserDocument): Promise<{
        message: string;
        user: UserDocument;
    }>;
    updateProfile(user: UserDocument, updateUserDto: UpdateUserDto): Promise<{
        message: string;
        user: UserDocument;
    }>;
    logout(user: UserDocument): Promise<{
        message: string;
    }>;
    refreshTokens(body: {
        refreshToken: string;
        userId: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        message: string;
    }>;
    getAllUsers(): Promise<{
        message: string;
        users: UserDocument[];
        count: number;
    }>;
    getUsersByRole(role: UserRole): Promise<{
        message: string;
        users: UserDocument[];
        count: number;
    }>;
    getUserById(id: string): Promise<{
        message: string;
        user: UserDocument;
    }>;
    updateUser(id: string, updateUserDto: UpdateUserDto): Promise<{
        message: string;
        user: UserDocument;
    }>;
    deactivateUser(id: string): Promise<{
        message: string;
        user: UserDocument;
    }>;
    reactivateUser(id: string): Promise<{
        message: string;
        user: UserDocument;
    }>;
    addDiscoveredClue(userId: string, clueId: string): Promise<{
        message: string;
        user: UserDocument;
    }>;
    addScore(userId: string, body: {
        points: number;
    }): Promise<{
        message: string;
        user: UserDocument;
    }>;
}
