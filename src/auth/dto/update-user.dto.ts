// src/auth/dto/update-user.dto.ts
import { IsString, IsOptional, MinLength, IsEnum, Matches } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'El celular debe tener entre 7 y 15 dígitos (puede iniciar con +)',
  })
  celular?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}