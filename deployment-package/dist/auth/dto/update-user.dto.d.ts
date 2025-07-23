import { UserRole } from '../schemas/user.schema';
export declare class UpdateUserDto {
    name?: string;
    role?: UserRole;
    password?: string;
}
