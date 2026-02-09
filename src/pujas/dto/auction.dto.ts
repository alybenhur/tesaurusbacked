import { 
  IsNotEmpty, 
  IsNumber, 
  IsDateString, 
  IsMongoId, 
  Min,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  IsArray
} from 'class-validator';
import { Type } from 'class-transformer';

// ✅ NUEVO DTO - Representa una pista excluida y su sponsor asignado
export class ExcludedClueAssignmentDto {
  @IsNotEmpty()
  @IsMongoId()
  clueId: string;

  @IsNotEmpty()
  @IsMongoId()
  sponsorId: string;
}

export class CreateAuctionDto {
  @IsNotEmpty()
  @IsMongoId()
  gameId: string;

  @IsNumber()
  @Min(0)
  startingAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startingAmountCollaborative?: number; 
  
  @IsNumber()
  @Min(1)
  incrementValue: number;
 
  @IsDateString()
  closingDate: string;

  // ✅ CAMPO EXISTENTE - IDs de pistas seleccionadas para subasta
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una pista' })
  clueIds?: string[];

  // ✅ NUEVO CAMPO - Asignaciones de pistas excluidas
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcludedClueAssignmentDto)
  excludedClueAssignments?: ExcludedClueAssignmentDto[];
}

export class PlaceBidDto {
  @IsNotEmpty()
  @IsMongoId()
  clueId: string;

  @IsNotEmpty()
  @IsMongoId()
  sponsorId: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class BiddableClueResponseDto {
  clueId: string;
  clueTitle: string;
  currentBid: number;
  currentBidderId?: string;
  currentBidderName?: string;
  isWon: boolean;
}

export class AuctionResponseDto {
  id: string;
  gameId: string;
  gameName: string;
  startingAmount: number;
  startingAmountCollaborative?: number;
  incrementValue: number;
  status: string;
  biddableClues: BiddableClueResponseDto[];
  closingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class BidResponseDto {
  id: string;
  clueId: string;
  clueTitle: string;
  sponsorId: string;
  sponsorName: string;
  amount: number;
  timestamp: Date;
}

export class ClueInfoDto {
  id: string;
  title: string;
  description: string;
  currentBid: number;
  isCollaborative: boolean;
  currentBidderId?: string;
  currentBidderName?: string;
}

export class BidInfoDto {
  amount: number;
  timestamp: Date;
}

export class AuctionInfoDto {
  id: string;
  incrementValue: number;
  status: string;
  closingDate: Date;
}

export class ClueBidInfoDto {
  hasBid: boolean;
  currentBid: number;
  currentBidderId?: string;
  currentBidderName?: string;
  minimumNextBid: number;
  isUserBidding: boolean;
}

export class CollaborativeClueDetailDto {
  _id: string;
  title: string;
  type?: string;
  isCollaborative?: boolean;
  requiredPlayers: number;
  bidInfo: ClueBidInfoDto;
}

export class AvailableGameDto {
  id: string;
  name: string;
  description: string;
  maxPlayers: number;
  collaborativeClues: number;
  totalClues?: number;
  hasActiveAuction: boolean;
  auctionInfo?: {
    closingDate: Date;
    startingAmount: number;
    startingAmountCollaborative?: number;
    incrementValue: number;
    biddableClues: {
      clueId: string;
      clueTitle: string;
      isCollaborative: boolean;
      type: string;           
      currentBid: number;
      currentBidderId?: string;
      currentBidderName?: string;
    }[];
  };
  createdAt: Date;
  collaborativeCluesDetails: CollaborativeClueDetailDto[];
}

export class AvailableGamesResponseDto {
  availableGames: AvailableGameDto[];
  totalAvailable: number;
  sponsorInfo: {
    id: string;
    name: string;
  };
}

export class SponsorActiveBidResponseDto {
  hasActiveBid: boolean;
  clue?: ClueInfoDto;
  sponsorBid?: BidInfoDto;
  auction?: AuctionInfoDto;
  nextMinimumBid?: number;
  canBid: boolean;
  message: string;
  availableClues?: ClueInfoDto[];
}

export class BidHistoryResponseDto {
  auctionId: string;
  gameId: string;
  gameName: string;
  bids: BidResponseDto[];
  totalBids: number;
}

export class ActiveBidsResponseDto {
  activeBids: ActiveGameBidDto[];
  totalActiveBids: number;
  sponsorInfo: {
    id: string;
    name: string;
  };
}

export class ActiveGameBidDto {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  
  clueInfo: {
    id: string;
    title: string;
    description: string;
  };
  
  sponsorBid: {
    amount: number;
    timestamp: Date;
    isWinning: boolean;
  };
  
  auctionStatus: {
    currentHighestBid: number;
    currentWinnerId?: string;
    currentWinnerName?: string;
    nextMinimumBid: number;
    closingDate: Date;
    incrementValue: number;
  };
}