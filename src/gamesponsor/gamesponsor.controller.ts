import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  NotFoundException
} from '@nestjs/common';
import { GameSponsorAssociationService } from './gamesponsor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
//import { RolesGuard } from '../auth/guards/roles.guard';

import {
  CreateGameSponsorDto,
  AssignSponsorToGameDto,
  AssignSponsorToClueDto,
  UpdateGameSponsorDto,
  ReassignSponsorDto,
  UnlockClueDto,
  BulkUnlockClueDto,
  GameSponsorQueryDto,
  ValidateSponsorUnlockDto,
  CheckSponsorAvailabilityDto
} from './dto/game-sponsor.dto';

@Controller('gamessponsors')
//@UseGuards(JwtAuthGuard, RolesGuard)
export class GameSponsorController {
  constructor(
    private readonly gameSponsorService: GameSponsorAssociationService
  ) {}

  // =====================================================
  // ASIGNACIÓN DE SPONSORS
  // =====================================================

  @Post(':gameId/sponsors')
  @HttpCode(HttpStatus.CREATED)
  async assignSponsorToGame(
    @Param('gameId') gameId: string,
    @Body(ValidationPipe) assignDto: AssignSponsorToGameDto
  ) {
    console.log(assignDto)
    return await this.gameSponsorService.assignSponsorToGame(gameId, assignDto);
  }

  @Post(':gameId/clues/:clueId/sponsors')
  @HttpCode(HttpStatus.CREATED)
   async assignSponsorToClue(
    @Param('gameId') gameId: string,
    @Param('clueId') clueId: string,
    @Body(ValidationPipe) assignDto: AssignSponsorToClueDto
  ) {
    console.log(assignDto)
    return await this.gameSponsorService.assignSponsorToClue(gameId, {
      ...assignDto,
      clueId
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGameSponsorAssociation(
    @Body(ValidationPipe) createDto: CreateGameSponsorDto
  ) {
    return await this.gameSponsorService.createGameSponsorAssociation(createDto);
  }

  // =====================================================
  // ACTUALIZACIÓN Y REASIGNACIÓN
  // =====================================================

  @Put(':gameId/sponsors/:sponsorId')
   async updateGameSponsor(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string,
    @Body(ValidationPipe) updateDto: UpdateGameSponsorDto
  ) {
    return await this.gameSponsorService.updateGameSponsor(gameId, sponsorId, updateDto);
  }

  @Put(':gameId/sponsors/:sponsorId/reassign')
   async reassignSponsor(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string,
    @Body(ValidationPipe) reassignDto: ReassignSponsorDto
  ) {
    return await this.gameSponsorService.reassignSponsor(gameId, sponsorId, reassignDto);
  }

  // =====================================================
  // DESBLOQUEO DE PISTAS
  // =====================================================

  @Post(':gameId/sponsors/:sponsorId/unlock')
  @HttpCode(HttpStatus.OK)
   async unlockClueUsingSponsor(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string,
    @Body(ValidationPipe) unlockDto: UnlockClueDto
  ) {
    return await this.gameSponsorService.unlockClueForPlayer({
      ...unlockDto,
      gameId,
      sponsorId
    });
  }

  @Post(':gameId/sponsors/:sponsorId/bulk-unlock')
  @HttpCode(HttpStatus.OK)
  async bulkUnlockClue(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string,
    @Body(ValidationPipe) bulkUnlockDto: BulkUnlockClueDto
  ) {
    return await this.gameSponsorService.bulkUnlockClue({
      ...bulkUnlockDto,
      gameId,
      sponsorId
    });
  }

  // =====================================================
  // CONSULTAS Y BÚSQUEDAS
  // =====================================================

  @Get(':gameId/sponsors')
   async getGameSponsors(
    @Param('gameId') gameId: string,
  ) {
    return await this.gameSponsorService.getGameSponsors(gameId);
  }

  @Get(':gameId/sponsors/:sponsorId')
   async getSponsorInGame(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string
  ) {
    const sponsor = await this.gameSponsorService.findSponsorInGame(gameId, sponsorId);
    if (!sponsor) {
      throw new NotFoundException('Sponsor not found in this game');
    }
    return sponsor;
  }

  @Get(':gameId/clues/:clueId/sponsors')
  async getClueSponsors(
    @Param('gameId') gameId: string,
    @Param('clueId') clueId: string
  ) {
    return await this.gameSponsorService.getClueSponsors(gameId, clueId);
  }

  @Get('sponsors/:sponsorId/games')
  async getSponsorGames(
    @Param('sponsorId') sponsorId: string
  ) {
    return await this.gameSponsorService.getSponsorGames(sponsorId);
  }

  // =====================================================
  // VALIDACIONES
  // =====================================================

  @Post(':gameId/sponsors/:sponsorId/validate-unlock')
  @HttpCode(HttpStatus.OK)
   async validateSponsorUnlock(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string,
    @Body(ValidationPipe) validateDto: ValidateSponsorUnlockDto
  ) {
    return await this.gameSponsorService.validateSponsorUnlock({
      ...validateDto,
      gameId,
      sponsorId
    });
  }

  @Get(':gameId/sponsors/:sponsorId/availability')
   async checkSponsorAvailability(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string,
    @Query('clueId') clueId?: string
  ) {
    const checkDto: CheckSponsorAvailabilityDto = {
      gameId,
      sponsorId,
      clueId
    };
    
    const sponsor = await this.gameSponsorService.findSponsorInGame(gameId, sponsorId);
    if (!sponsor) {
      return { available: false, reason: 'Sponsor not found in game' };
    }

    return {
      available: sponsor.canUnlock,
      isGeneralSponsor: sponsor.isGeneralSponsor,
      isClueSponsor: sponsor.isClueSponsor,
      isActive: sponsor.isActive,
      totalUnlocks: sponsor.totalUnlocks,
      clueId: sponsor.clueId
    };
  }

  // =====================================================
  // ESTADÍSTICAS E HISTORIAL
  // =====================================================

  @Get(':gameId/sponsors/stats')
   async getGameSponsorStats(
    @Param('gameId') gameId: string
  ) {
    return await this.gameSponsorService.getGameSponsorStats(gameId);
  }

  @Get('players/:playerId/sponsor-history')
   async getPlayerSponsorHistory(
    @Param('playerId') playerId: string
  ) {
    return await this.gameSponsorService.getPlayerSponsorHistory(playerId);
  }

  // =====================================================
  // ELIMINACIÓN Y DESACTIVACIÓN
  // =====================================================

  @Delete(':gameId/sponsors/:sponsorId')
  @HttpCode(HttpStatus.NO_CONTENT)
   async removeSponsorFromGame(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string
  ) {
    const removed = await this.gameSponsorService.removeSponsorFromGame(gameId, sponsorId);
    if (!removed) {
      throw new NotFoundException('Sponsor association not found');
    }
  }

  @Put(':gameId/sponsors/:sponsorId/deactivate')
   async deactivateSponsor(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string
  ) {
    return await this.gameSponsorService.deactivateSponsor(gameId, sponsorId);
  }

  @Put(':gameId/sponsors/:sponsorId/activate')
   async activateSponsor(
    @Param('gameId') gameId: string,
    @Param('sponsorId') sponsorId: string
  ) {
    return await this.gameSponsorService.updateGameSponsor(gameId, sponsorId, { isActive: true });
  }
}