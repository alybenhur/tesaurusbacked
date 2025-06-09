import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, Length, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class LocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  accuracy?: number = 10;
}

export class CreateClueDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  @Transform(({ value }) => value?.trim())
  description: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 300)
  @Transform(({ value }) => value?.trim())
  hint: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(500)
  radius?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  difficulty?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(1000)
  points?: number = 100;

  @IsOptional()
  @IsString()
  category?: string = 'general';
}

export class ValidateQRDto {
  @IsString()
  @IsNotEmpty()
  qrCode: string;

  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  playerLocation?: LocationDto;
}

export class UpdateClueDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @IsOptional()
  @IsString()
  @Length(10, 500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsString()
  @Length(10, 300)
  @Transform(({ value }) => value?.trim())
  hint?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(500)
  radius?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(1000)
  points?: number;
}