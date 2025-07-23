import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateClueDto } from '../../clues/dto/create-clue.dto';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  adminId: string;

  @IsNumber()
  @Min(2)
  @Max(20)
  maxPlayers: number;

  @IsNumber()
  @Min(0)
  revealDelayMs: number;

  // NUEVO: Array de pistas para crear junto con el juego
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClueDto)
  clues?: CreateClueDto[];
}

export class JoinGameDto {
  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsOptional()
  @IsString()
  playerName?: string;
}