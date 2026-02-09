import { IsOptional, IsString, IsObject, ValidateNested, IsNumber, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateLocationDto {
  @IsNumber({}, { message: 'La latitud debe ser un número válido' })
  latitude: number;

  @IsNumber({}, { message: 'La longitud debe ser un número válido' })
  longitude: number;
}

export class UpdateClueDto {
  @IsOptional()
  @IsString({ message: 'El título debe ser una cadena de texto' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateLocationDto)
  location?: UpdateLocationDto;

  @IsOptional()
  @IsUrl({}, { message: 'La URL de la imagen debe ser válida' })
  imageUrl?: string;
}