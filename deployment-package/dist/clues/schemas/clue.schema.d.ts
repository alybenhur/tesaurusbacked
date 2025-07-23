import { Document, Types } from 'mongoose';
export declare enum ClueStatus {
    HIDDEN = "hidden",
    DISCOVERED = "discovered",
    REVEALED = "revealed"
}
export declare class ClueLocation {
    latitude: number;
    longitude: number;
    address?: string;
    description?: string;
}
export declare class Clue extends Document {
    gameId: Types.ObjectId;
    title: string;
    description: string;
    hint?: string;
    idPista: string;
    location?: ClueLocation;
    qrCode?: string;
    order: number;
    isCompleted: boolean;
    status: ClueStatus;
    discoveredBy?: Types.ObjectId;
    discoveredAt?: Date;
    range?: number;
    answer?: string;
    imageUrl?: string;
    content?: Record<string, any>;
    hints?: string[];
    pointsValue?: number;
    timeLimit?: number;
    type: string;
    isCollaborative: boolean;
    requiredPlayers?: number;
    collaborativeTimeLimit?: number;
}
export type ClueDocument = Clue & Document;
export declare const ClueSchema: import("mongoose").Schema<Clue, import("mongoose").Model<Clue, any, any, any, Document<unknown, any, Clue, any> & Clue & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Clue, Document<unknown, {}, import("mongoose").FlatRecord<Clue>, {}> & import("mongoose").FlatRecord<Clue> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
