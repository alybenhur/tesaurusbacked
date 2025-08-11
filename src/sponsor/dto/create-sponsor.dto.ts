import { IsString, IsNotEmpty, IsEmail, IsUrl, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSponsorDto {
  @IsString({ message: 'El NIT debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El NIT es obligatorio' })
  @Matches(/^[0-9]{8,15}-[0-9]$/, { 
    message: 'El NIT debe tener el formato válido (ej: 123456789-0)' 
  })
  @Transform(({ value }) => value?.trim())
  nit: string;

  @IsString({ message: 'El nombre de la empresa debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la empresa es obligatorio' })
  @Transform(({ value }) => value?.trim())
  nombreEmpresa: string;

  @IsString({ message: 'El representante legal debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El representante legal es obligatorio' })
  @Transform(({ value }) => value?.trim())
  representanteLegal: string;

  @IsString({ message: 'El celular debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El celular es obligatorio' })
  @Matches(/^(\+57|57)?[3][0-9]{9}$/, { 
    message: 'El celular debe tener un formato válido colombiano (ej: +573001234567, 573001234567, o 3001234567)' 
  })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ''))
  celular: string;

  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  correo: string;

  @IsUrl({}, { message: 'El logo debe ser una URL válida' })
  @IsNotEmpty({ message: 'El logo es obligatorio' })
  @Transform(({ value }) => value?.trim())
  logo: string;
}