import { Document, Types } from 'mongoose';
export declare enum CollaborativeAttemptStatus {
    ACTIVE = "active",
    COMPLETED = "completed",
    EXPIRED = "expired"
}
export declare class CollaborativeAttempt {
    clueId: Types.ObjectId;
    gameId: Types.ObjectId;
    participantIds: string[];
    requiredPlayers: number;
    startedAt: Date;
    expiresAt: Date;
    status: CollaborativeAttemptStatus;
    initiatedBy: string;
    completedAt?: Date;
}
export type CollaborativeAttemptDocument = CollaborativeAttempt & Document;
export declare const CollaborativeAttemptSchema: import("mongoose").Schema<CollaborativeAttempt, import("mongoose").Model<CollaborativeAttempt, any, any, any, Document<unknown, any, CollaborativeAttempt, any> & CollaborativeAttempt & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, CollaborativeAttempt, Document<unknown, {}, import("mongoose").FlatRecord<CollaborativeAttempt>, {}> & import("mongoose").FlatRecord<CollaborativeAttempt> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
