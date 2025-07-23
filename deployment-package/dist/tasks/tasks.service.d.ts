import { GamesService } from '../games/games.service';
export declare class TasksService {
    private readonly gamesService;
    private readonly logger;
    constructor(gamesService: GamesService);
    handleExpiredCollaborativeAttempts(): Promise<void>;
    manualCleanup(): Promise<any>;
    getCleanupStats(): any;
    private sendErrorNotification;
}
