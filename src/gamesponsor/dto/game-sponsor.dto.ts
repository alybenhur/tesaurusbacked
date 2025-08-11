import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsNumber, 
  IsBoolean, 
  IsDateString,
  Min,
  IsMongoId,
  IsNotEmpty,
  ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';

// =====================================================
// CREATE/ASSIGN DTOs
// =====================================================

export class CreateGameSponsorDto {
  @IsMongoId()
  @IsNotEmpty()
  gameId: string;

  @IsMongoId()
  @IsNotEmpty()
  sponsorId: string;

  @IsOptional()
  @IsMongoId()
  clueId?: string; // null = sponsor general, valor = sponsor de pista específica

  @IsOptional()
  @IsEnum(['main', 'secondary', 'media', 'prize'])
  sponsorshipType?: string = 'prize';

  @IsOptional()
  @IsNumber()
  @Min(0)
  sponsorshipAmount?: number;

  @IsOptional()
  @IsString()
  sponsorshipDescription?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AssignSponsorToGameDto {
  @IsMongoId()
  @IsNotEmpty()
  sponsorId: string;

  @IsOptional()
  @IsEnum(['main', 'secondary', 'media', 'prize'])
  sponsorshipType?: string = 'prize';

  @IsOptional()
  @IsNumber()
  @Min(0)
  sponsorshipAmount?: number;

  @IsOptional()
  @IsString()
  sponsorshipDescription?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AssignSponsorToClueDto {
  @IsMongoId()
  @IsNotEmpty()
  sponsorId: string;

  @IsMongoId()
  @IsNotEmpty()
  clueId: string;

  @IsOptional()
  @IsEnum(['main', 'secondary', 'media', 'prize'])
  sponsorshipType?: string = 'prize';

  @IsOptional()
  @IsNumber()
  @Min(0)
  sponsorshipAmount?: number;

  @IsOptional()
  @IsString()
  sponsorshipDescription?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// =====================================================
// UPDATE DTOs
// =====================================================

export class UpdateGameSponsorDto {
  @IsOptional()
  @IsMongoId()
  clueId?: string | null; // Permite cambiar de sponsor general a sponsor de pista

  @IsOptional()
  @IsEnum(['main', 'secondary', 'media', 'prize'])
  sponsorshipType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sponsorshipAmount?: number;

  @IsOptional()
  @IsString()
  sponsorshipDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ReassignSponsorDto {
  @IsOptional()
  @IsMongoId()
  newClueId?: string | null; // null = cambiar a sponsor general, valor = cambiar a otra pista

  @IsOptional()
  @IsString()
  reason?: string; // Razón del cambio
}

// =====================================================
// UNLOCK DTOs
// =====================================================

export class UnlockClueDto {
  @IsMongoId()
  @IsNotEmpty()
  playerId: string;

  @IsMongoId()
  @IsNotEmpty()
  sponsorId: string;

  @IsMongoId()
  @IsNotEmpty()
  gameId: string;

  @IsOptional()
  @IsMongoId()
  clueId?: string; // Para validación adicional
}

export class BulkUnlockClueDto {
  @IsMongoId({ each: true })
  @IsNotEmpty()
  playerIds: string[];

  @IsMongoId()
  @IsNotEmpty()
  sponsorId: string;

  @IsMongoId()
  @IsNotEmpty()
  gameId: string;
}

// =====================================================
// QUERY/FILTER DTOs
// =====================================================

export class GameSponsorQueryDto {
  @IsOptional()
  @IsMongoId()
  gameId?: string;

  @IsOptional()
  @IsMongoId()
  sponsorId?: string;

  @IsOptional()
  @IsMongoId()
  clueId?: string;

  @IsOptional()
  @IsEnum(['main', 'secondary', 'media', 'prize'])
  sponsorshipType?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isGeneralSponsor?: boolean; // true = solo sponsors generales

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isClueSponsor?: boolean; // true = solo sponsors de pista

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}

// =====================================================
// RESPONSE DTOs
// =====================================================

export class SponsorUnlockHistoryDto {
  playerId: string;
  playerName?: string;
  unlockedAt: Date;
}

export class GameSponsorResponseDto {
  id: string;
  gameId: string;
  gameName?: string;
  sponsorId: string;
  sponsorName?: string;
  sponsorLogo?: string;
  clueId?: string | null;
  clueTitle?: string;
  sponsorshipType: string;
  sponsorshipAmount?: number;
  sponsorshipDescription?: string;
  totalUnlocks: number;
  isActive: boolean;
  isGeneralSponsor: boolean;
  isClueSponsor: boolean;
  canUnlock: boolean;
  startDate?: Date;
  endDate?: Date;
  unlockedFor: SponsorUnlockHistoryDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class SponsorStatsDto {
  totalSponsors: number;
  generalSponsors: number;
  clueSponsors: number;
  totalUnlocks: number;
  activeSponsors: number;
  inactiveSponsors: number;
}

export class PlayerSponsorHistoryDto {
  playerId: string;
  playerName?: string;
  sponsorId: string;
  sponsorName?: string;
  clueId: string;
  clueTitle?: string;
  gameId: string;
  gameName?: string;
  unlockedAt: Date;
}

// =====================================================
// VALIDATION DTOs
// =====================================================

export class ValidateSponsorUnlockDto {
  @IsMongoId()
  @IsNotEmpty()
  playerId: string;

  @IsMongoId()
  @IsNotEmpty()
  sponsorId: string;

  @IsMongoId()
  @IsNotEmpty()
  gameId: string;
}

export class CheckSponsorAvailabilityDto {
  @IsMongoId()
  @IsNotEmpty()
  sponsorId: string;

  @IsMongoId()
  @IsNotEmpty()
  gameId: string;

  @IsOptional()
  @IsMongoId()
  clueId?: string;
}