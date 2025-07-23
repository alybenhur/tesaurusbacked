import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameStatus } from './schemas/game.schema';
import { DiscoverClueDto } from './dto/discover-clue.dto';
export declare class JoinGameDto {
    playerId: string;
    playerName?: string;
}
export declare class GamesController {
    private readonly gamesService;
    constructor(gamesService: GamesService);
    create(createGameDto: CreateGameDto): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    findAll(status?: string, adminId?: string): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game[];
        count: number;
    }>;
    findActiveGames(): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game[];
        count: number;
    }>;
    findAvailable(): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game[];
        count: number;
    }>;
    findOne(id: string): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    getGameStats(id: string): Promise<{
        success: boolean;
        message: string;
        data: {
            gameId: string;
            totalPlayers: number;
            maxPlayers: number;
            totalClues: number;
            completedClues: number;
            progress: number;
            status: GameStatus;
            duration: number;
            lastActivity: Date;
        };
    }>;
    update(id: string, updateGameDto: UpdateGameDto): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    startGame(id: string): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    joinGame(id: string, joinGameDto: JoinGameDto): Promise<{
        success: boolean;
        message: string;
        data: {
            game: import("./schemas/game.schema").Game;
            firstClue: import("../clues/schemas/clue.schema").Clue;
        };
    }>;
    leaveGame(id: string, body: {
        playerId: string;
    }): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    remove(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getGamePlayers(id: string): Promise<{
        success: boolean;
        message: string;
        data: {
            gameId: string;
            gameName: string;
            totalPlayers: number;
            maxPlayers: number;
            players: {
                id: string;
                name: string;
                isAdmin: boolean;
                joinedAt: Date;
            }[];
        };
    }>;
    getGameClues(id: string): Promise<{
        success: boolean;
        message: string;
        data: {
            gameId: string;
            gameName: string;
            totalClues: number;
            clues: import("mongoose").Types.ObjectId[];
        };
    }>;
    finishGame(id: string): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    cancelGame(id: string): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    removeClueFromGame(gameId: string, clueId: string): Promise<{
        success: boolean;
        message: string;
        data: import("./schemas/game.schema").Game;
    }>;
    getPlayerGames(playerId: string): Promise<{
        success: boolean;
        message: string;
        data: any[];
        count: number;
    }>;
    discoverClue(discoverClueDto: DiscoverClueDto): Promise<{
        success: boolean;
        message: string;
        data: {
            clue: import("../clues/schemas/clue.schema").Clue;
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
        };
    }>;
    getCollaborativeStatus(gameId: string, clueId: string): Promise<{
        success: boolean;
        message: string;
        data: any;
    }>;
    getPlayerWins(playerId: string): Promise<{
        success: boolean;
        message: string;
        data: {
            totalWins: number;
            allWins: any[];
        };
    }>;
    getPlayerAchievementStats(playerId: string): Promise<{
        success: boolean;
        message: string;
        data: any;
    }>;
}
