import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  @Transform(({ value }) => value?.trim())
  description: string;

  @IsString()
  @IsNotEmpty()
  adminId: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(20)
  maxPlayers?: number = 8;

  @IsOptional()
  @IsNumber()
  @Min(60000) // Mínimo 1 minuto
  @Max(1800000) // Máximo 30 minutos
  revealDelayMs?: number = 600000; // 10 minutos por defecto
}

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @Length(10, 500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(20)
  maxPlayers?: number;

  @IsOptional()
  @IsNumber()
  @Min(60000)
  @Max(1800000)
  revealDelayMs?: number;
}

export class JoinGameDto {
  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsString()
  @IsNotEmpty()
  playerName: string;
}