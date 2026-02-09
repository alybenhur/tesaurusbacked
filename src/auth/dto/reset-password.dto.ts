import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PasswordMatch } from '../decorators/password-match.decorator';

export class ResetPasswordDto {
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

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/,
    { 
      message: 'La contraseña debe contener al menos una letra minúscula, una mayúscula y un número' 
    }
  )
  newPassword: string;

  @IsString({ message: 'La confirmación de contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La confirmación de contraseña es requerida' })
  @PasswordMatch('newPassword', { 
    message: 'La confirmación de contraseña debe coincidir con la nueva contraseña' 
  })
  confirmPassword: string;
}