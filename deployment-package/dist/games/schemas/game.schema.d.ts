import { Document, Types } from 'mongoose';
export type GameDocument = Game & Document & {
    createdAt: Date;
    updatedAt: Date;
};
export declare enum GameStatus {
    WAITING = "waiting",
    ACTIVE = "active",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare class Game {
    name: string;
    description: string;
    adminId: string;
    status: GameStatus;
    playerIds: string[];
    clues: Types.ObjectId[];
    startedAt?: Date;
    finishedAt?: Date;
    winnerId?: string;
    maxPlayers: number;
    revealDelayMs: number;
    gameArea: {
        center: {
            latitude: number;
            longitude: number;
        };
        bounds: {
            northEast: {
                latitude: number;
                longitude: number;
            };
            southWest: {
                latitude: number;
                longitude: number;
            };
        };
    };
    metadata: {
        totalClues: number;
        completedClues: number;
        lastActivity: Date;
    };
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const GameSchema: import("mongoose").Schema<Game, import("mongoose").Model<Game, any, any, any, Document<unknown, any, Game, any> & Game & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Game, Document<unknown, {}, import("mongoose").FlatRecord<Game>, {}> & import("mongoose").FlatRecord<Game> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
