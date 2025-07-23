import { Document, Types } from 'mongoose';
export type PlayerAchievementDocument = PlayerAchievement & Document;
export declare enum AchievementType {
    GAME_WIN = "game_win",
    GAME_PARTICIPATION = "game_participation",
    FIRST_CLUE = "first_clue",
    SPEED_RUN = "speed_run",
    COLLABORATIVE_MASTER = "collaborative_master"
}
export declare class PlayerAchievement {
    playerId: string;
    gameId: Types.ObjectId;
    achievementType: AchievementType;
    completedAt: Date;
    gameDetails: {
        name: string;
        description: string;
        totalClues: number;
        startedAt: Date;
        completionTimeMinutes: number;
        playerStats: {
            cluesDiscovered: number;
            collaborativeCluesParticipated: number;
            totalParticipants: number;
        };
    };
}
export declare const PlayerAchievementSchema: import("mongoose").Schema<PlayerAchievement, import("mongoose").Model<PlayerAchievement, any, any, any, Document<unknown, any, PlayerAchievement, any> & PlayerAchievement & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PlayerAchievement, Document<unknown, {}, import("mongoose").FlatRecord<PlayerAchievement>, {}> & import("mongoose").FlatRecord<PlayerAchievement> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
