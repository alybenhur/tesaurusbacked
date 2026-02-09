import { AuctionStatus } from '../schemas/auction.schema';

export class AuctionInfoDto {
  gameId: string;
  status: AuctionStatus;
  closingDate: Date;
  startingAmount: number;
  incrementValue: number;
  totalClues: number;
  wonClues: number;
}

export class ClueInfoDto {
  id: string;
  title: string;
  description: string;
  type: string;
}

export class SponsorBidderDto {
  sponsorId: string;
  nombreEmpresa: string;
  representanteLegal: string;
  celular: string;
  correo: string;
  nit: string;
}

export class BiddingInfoDto {
  isWon: boolean;
  currentBid: number;
  currentBidder?: SponsorBidderDto;
}

export class ClueResultDto {
  clue: ClueInfoDto;
  bidding: BiddingInfoDto;
}

export class AuctionResultsResponseDto {
  auction: AuctionInfoDto;
  results: ClueResultDto[];
}