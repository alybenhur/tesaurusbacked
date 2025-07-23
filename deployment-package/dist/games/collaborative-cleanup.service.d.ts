import { Model } from 'mongoose';
import { CollaborativeAttemptDocument } from '../games/schemas/collaborative-attempt.schema';
export declare class CollaborativeCleanupService {
    private collaborativeAttemptModel;
    private readonly logger;
    constructor(collaborativeAttemptModel: Model<CollaborativeAttemptDocument>);
    cleanupExpiredAttempts(): Promise<void>;
    runCleanup(): Promise<{
        expired: number;
        deleted: number;
    }>;
    getStats(): Promise<{
        active: number;
        completed: number;
        expired: number;
        total: number;
    }>;
}
