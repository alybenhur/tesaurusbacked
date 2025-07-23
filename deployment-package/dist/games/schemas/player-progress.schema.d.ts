import { Document, Types } from 'mongoose';
import { ClueStatus } from '../../clues/schemas/clue.schema';
export type PlayerProgressDocument = PlayerProgress & Document;
export declare class PlayerProgress {
    gameId: Types.ObjectId;
    playerId: string;
    clues: {
        clueId: Types.ObjectId;
        status: ClueStatus;
        discoveredAt?: Date;
    }[];
    totalPoints: number;
    lastActivity: Date;
}
export declare const PlayerProgressSchema: import("mongoose").Schema<PlayerProgress, import("mongoose").Model<PlayerProgress, any, any, any, Document<unknown, any, PlayerProgress, any> & PlayerProgress & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PlayerProgress, Document<unknown, {}, import("mongoose").FlatRecord<PlayerProgress>, {}> & import("mongoose").FlatRecord<PlayerProgress> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
