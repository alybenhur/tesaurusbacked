import { PartialType } from '@nestjs/mapped-types';
import { CreateGameDto } from './create-game.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { GameStatus } from '../schemas/game.schema';

export class UpdateGameDto extends PartialType(CreateGameDto) {
  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;

  @IsOptional()
  finishedAt?: Date;
}