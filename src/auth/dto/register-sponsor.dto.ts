import { IsEmail, IsString, MinLength } from 'class-validator';
import { CreateSponsorDto } from '../../sponsor/dto/create-sponsor.dto';
import { Transform } from 'class-transformer';

export class RegisterSponsorDto extends CreateSponsorDto {
  // Campos adicionales para el usuario
  @IsString({ message: 'El nombre del usuario debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  // Note: El email ya viene de CreateSponsorDto como 'correo'
  // pero para el User necesitamos 'email', así que lo mapeamos en el service
}