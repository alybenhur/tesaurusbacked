import { IsString, IsNotEmpty, IsEmail, IsUrl, Matches, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateSponsorDto {
  @IsOptional()
  @IsString({ message: 'El NIT debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El NIT no puede estar vacío' })
  @Matches(/^[0-9]{8,15}-[0-9]$/, { 
    message: 'El NIT debe tener el formato válido (ej: 123456789-0)' 
  })
  @Transform(({ value }) => value?.trim())
  nit?: string;

  @IsOptional()
  @IsString({ message: 'El nombre de la empresa debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la empresa no puede estar vacío' })
  @Transform(({ value }) => value?.trim())
  nombreEmpresa?: string;

  @IsOptional()
  @IsString({ message: 'El representante legal debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El representante legal no puede estar vacío' })
  @Transform(({ value }) => value?.trim())
  representanteLegal?: string;

  @IsOptional()
  @IsString({ message: 'El celular debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El celular no puede estar vacío' })
  @Matches(/^(\+57|57)?[3][0-9]{9}$/, { 
    message: 'El celular debe tener un formato válido colombiano (ej: +573001234567, 573001234567, o 3001234567)' 
  })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ''))
  celular?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo no puede estar vacío' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  correo?: string;

  @IsOptional()
  @IsUrl({}, { message: 'El logo debe ser una URL válida' })
  @IsNotEmpty({ message: 'El logo no puede estar vacío' })
  @Transform(({ value }) => value?.trim())
  logo?: string;
}