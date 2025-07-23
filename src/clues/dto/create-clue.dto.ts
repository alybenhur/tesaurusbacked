import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsBoolean, ValidateIf } from 'class-validator';

export class CreateClueDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  hint?: string;

  @IsString()
  @IsNotEmpty()
  idPista: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  locationDescription?: string;

  @IsOptional()
  @IsString()
  qrCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsNumber()
  range?: number;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  content?: Record<string, any>;

  @IsOptional()
  hints?: string[];

  @IsOptional()
  @IsNumber()
  pointsValue?: number;

  @IsOptional()
  @IsNumber()
  timeLimit?: number;

  @IsString()
  @IsNotEmpty()
  type: string;

  // ✅ NUEVOS CAMPOS: Para pistas colaborativas
  @IsOptional()
  @IsBoolean()
  isCollaborative?: boolean;

  @ValidateIf(o => o.isCollaborative === true)
  @IsNumber()
  @Min(2, { message: 'Se requieren al menos 2 jugadores para pistas colaborativas' })
  @Max(20, { message: 'Máximo 20 jugadores para pistas colaborativas' })
  requiredPlayers?: number;

 @ValidateIf(o => o.isCollaborative === true)
@IsNumber()
@Min(1, { message: 'Tiempo mínimo: 1 minuto' })
@Max(60, { message: 'Tiempo máximo: 60 minutos (1 hora)' })
collaborativeTimeLimit?: number; // En minutos
}