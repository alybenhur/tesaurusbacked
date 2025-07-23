import { CreateClueDto } from '../../clues/dto/create-clue.dto';
export declare class CreateGameDto {
    name: string;
    description: string;
    adminId: string;
    maxPlayers: number;
    revealDelayMs: number;
    clues?: CreateClueDto[];
}
export declare class JoinGameDto {
    playerId: string;
    playerName?: string;
}
