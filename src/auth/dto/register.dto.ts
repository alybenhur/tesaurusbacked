// src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, IsEnum, IsOptional, Matches } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  name: string;

  @IsEmail({}, { message: 'Debe ser un email válido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString({ message: 'El celular es requerido' })
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'El celular debe tener entre 7 y 15 dígitos (puede iniciar con +)',
  })
  celular: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Rol de usuario inválido' })
  role?: UserRole;
}