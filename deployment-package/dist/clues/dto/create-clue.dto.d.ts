export declare class CreateClueDto {
    title: string;
    description: string;
    hint?: string;
    idPista: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    locationDescription?: string;
    qrCode?: string;
    order?: number;
    range?: number;
    answer?: string;
    imageUrl?: string;
    content?: Record<string, any>;
    hints?: string[];
    pointsValue?: number;
    timeLimit?: number;
    type: string;
    isCollaborative?: boolean;
    requiredPlayers?: number;
    collaborativeTimeLimit?: number;
}
