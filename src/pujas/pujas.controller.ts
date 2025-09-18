import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  HttpCode, 
  HttpStatus,
  UseGuards,
  ValidationPipe,
  BadRequestException, 
  Put,
  HttpException
} from '@nestjs/common';
import { Types } from 'mongoose';

import { AuctionService } from './pujas.service';
import { 
  CreateAuctionDto, 
  PlaceBidDto, 
  AuctionResponseDto,
  BidHistoryResponseDto,
  SponsorActiveBidResponseDto,
  AvailableGamesResponseDto 
} from './dto/auction.dto';
import { AuctionResultsResponseDto } from './dto/auction-results.dto';

@Controller('auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  // Método helper para validar ObjectIds
  private validateObjectId(id: string, fieldName: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${fieldName} inválido`);
    }
  }

  @Post('game/:gameId')
  @HttpCode(HttpStatus.CREATED)
  async createAuction(
    @Param('gameId') gameId: string,
    @Body(ValidationPipe) createAuctionDto: CreateAuctionDto
  ): Promise<AuctionResponseDto> {
    this.validateObjectId(gameId, 'ID de juego');
    createAuctionDto.gameId = gameId;
    return this.auctionService.createAuction(createAuctionDto);
  }

  @Post('game/:gameId/bid')
  @HttpCode(HttpStatus.OK)
  async placeBid(
    @Param('gameId') gameId: string,
    @Body(ValidationPipe) placeBidDto: PlaceBidDto
  ): Promise<AuctionResponseDto> {
    console.log(placeBidDto)
    this.validateObjectId(gameId, 'ID de juego');
    return this.auctionService.placeBid(gameId, placeBidDto);
  }

  @Get('game/:gameId')
  async getAuctionByGameId(
    @Param('gameId') gameId: string
  ): Promise<AuctionResponseDto> {
    this.validateObjectId(gameId, 'ID de juego');
    return this.auctionService.getAuctionByGameId(gameId);
  }

  @Get('game/:gameId/bids')
  async getBidHistory(
    @Param('gameId') gameId: string
  ): Promise<BidHistoryResponseDto> {
    this.validateObjectId(gameId, 'ID de juego');
    return this.auctionService.getBidHistory(gameId);
  }

  @Get('game/:gameId/sponsor/:sponsorId/active-bid')
  async getSponsorActiveBid(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string
  ): Promise<SponsorActiveBidResponseDto> {
    this.validateObjectId(gameId, 'ID de juego');
    this.validateObjectId(sponsorId, 'ID de sponsor');
    return this.auctionService.getSponsorActiveBid(gameId, sponsorId);
  }

  @Get('sponsor/:sponsorId/available-games')
  async getSponsorAvailableGames(
    @Param('sponsorId') sponsorId: string
  ): Promise<AvailableGamesResponseDto> {
    this.validateObjectId(sponsorId, 'ID de sponsor');
    return this.auctionService.getUserAvailableGames(sponsorId);
  }

//obtiene las pistas de un sponsor que estan en puja

  @Get('user/:userId/active-bids')
    async getUserActiveBids(@Param('userId') userId: string) {
    return this.auctionService.getUserActiveBids(userId);
}

  @Get('game/:gameId/status')
  async canBid(@Param('gameId') gameId: string) {
    this.validateObjectId(gameId, 'ID de juego');
    try {
      const auction = await this.auctionService.getAuctionByGameId(gameId);
      const now = new Date();
      const timeLeft = auction.closingDate.getTime() - now.getTime();
      
      const canBid = auction.status === 'active' && timeLeft > 0;
      
      let reason = '';
      if (!canBid) {
        if (auction.status !== 'active') {
          reason = 'La subasta no está activa';
        } else if (timeLeft <= 0) {
          reason = 'La subasta ha expirado';
        }
      }

      return {
        canBid,
        reason,
        auctionStatus: auction.status,
        closingDate: auction.closingDate,
        timeLeft: Math.max(0, timeLeft)
      };
    } catch (error) {
      return {
        canBid: false,
        reason: 'No existe una subasta para este juego',
        auctionStatus: null,
        closingDate: null,
        timeLeft: 0
      };
    }
  }

  @Put('game/:gameId/bids')
   async updateBid(
    @Param('gameId') gameId: string,
    @Body() updateBidDto: PlaceBidDto
    ) {
      return this.auctionService.updateBid(gameId, updateBidDto);
    }

  @Get('game/:gameId/results')
   async getAuctionResults(
    @Param('gameId') gameId: string
  ): Promise<AuctionResultsResponseDto> {
    try {
      return await this.auctionService.getAuctionResults(gameId);
    } catch (error) {
      // Log del error para debugging
      console.error(`Error getting auction results for game ${gameId}:`, error);
      
      // Re-lanzar errores conocidos (NotFoundException)
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Manejar errores inesperados
      throw new HttpException(
        'Internal server error while getting auction results',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  
  
}