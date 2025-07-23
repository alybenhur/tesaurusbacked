import { Model } from 'mongoose';
import { Game, GameDocument } from './schemas/game.schema';
import { Clue, ClueDocument } from '../clues/schemas/clue.schema';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { PlayerProgressDocument } from './schemas/player-progress.schema';
import { CollaborativeAttemptDocument } from './schemas/collaborative-attempt.schema';
import { PlayerAchievementDocument } from './schemas/player-achievement.schema';
export declare class GamesService {
    private gameModel;
    private clueModel;
    private playerProgressModel;
    private collaborativeAttemptModel;
    private playerAchievementModel;
    constructor(gameModel: Model<GameDocument>, clueModel: Model<ClueDocument>, playerProgressModel: Model<PlayerProgressDocument>, collaborativeAttemptModel: Model<CollaborativeAttemptDocument>, playerAchievementModel: Model<PlayerAchievementDocument>);
    create(createGameDto: CreateGameDto): Promise<Game>;
    findActiveGames(): Promise<Game[]>;
    private createCluesForGame;
    removeClueFromGame(gameId: string, clueId: string): Promise<Game>;
    private calculateGameArea;
    findAll(): Promise<Game[]>;
    findOne(id: string): Promise<Game>;
    update(id: string, updateGameDto: UpdateGameDto): Promise<Game>;
    remove(id: string): Promise<void>;
    joinGame(gameId: string, playerId: string): Promise<{
        game: Game;
        firstClue: Clue | null;
    }>;
    leaveGame(gameId: string, playerId: string): Promise<Game>;
    startGame(gameId: string): Promise<Game>;
    getPlayerGames(playerId: string): Promise<{
        success: boolean;
        message: string;
        data: any[];
        count: number;
    }>;
    discoverClue(clueId: string, playerId: string, playerLatitude: number, playerLongitude: number): Promise<{
        clue: Clue;
        gameProgress: any;
        isGameCompleted: boolean;
        isCollaborative?: boolean;
        collaborativeStatus?: {
            currentParticipants: number;
            requiredParticipants: number;
            timeRemaining: number;
            status: string;
            participantIds: string[];
        };
        proximityInfo?: {
            distance: number;
            range: number;
            isWithinRange: boolean;
        };
    }>;
    private handleCollaborativeClue;
    private handleNormalClue;
    private attemptToWinGame;
    private processPlayerCompletionAchievements;
    private processPlayerParticipationAchievements;
    private validateClueOrder;
    private findOrCreateCollaborativeAttempt;
    private addPlayerToCollaborativeAttempt;
    private completeCollaborativeAttempt;
    private updatePlayerProgressForCollaborativeClue;
    private expireOldCollaborativeAttempts;
    getCollaborativeStatus(clueId: string, gameId: string): Promise<any>;
    private checkIfAllPlayersCompleted;
    cleanupExpiredCollaborativeAttempts(): Promise<import("mongodb").DeleteResult>;
    private createPlayerAchievement;
    getPlayerWins(playerId: string): Promise<{
        success: boolean;
        message: string;
        data: {
            totalWins: number;
            allWins: any[];
        };
    }>;
    private formatCompletionTime;
    getPlayerAchievementStats(playerId: string): Promise<any>;
    private processGameCompletionAchievements;
    private processPlayerAchievements;
    private calculatePlayerStats;
    private countCollaborativeParticipation;
    private determinePlayerAchievements;
    private createAchievementRecord;
    private calculateDistance;
    private toRadians;
    private validateProximity;
}
