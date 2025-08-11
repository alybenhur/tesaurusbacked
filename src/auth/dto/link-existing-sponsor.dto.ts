import { IsString, IsEmail, MinLength, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';

export class LinkExistingSponsorDto {
  @IsMongoId({ message: 'ID de sponsor inválido' })
  sponsorId: string;

  @IsString({ message: 'El nombre del usuario debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsEmail({}, { message: 'Debe ser un email válido' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}