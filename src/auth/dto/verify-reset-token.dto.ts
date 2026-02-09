import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyResetTokenDto {
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString({ message: 'El token debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El token es requerido' })
  @Length(4, 4, { message: 'El token debe tener exactamente 4 dígitos' })
  @Matches(/^\d{4}$/, { message: 'El token debe contener solo números' })
  @Transform(({ value }) => value?.trim())
  token: string;
}