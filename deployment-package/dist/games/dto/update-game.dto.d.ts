import { CreateGameDto } from './create-game.dto';
import { GameStatus } from '../schemas/game.schema';
declare const UpdateGameDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateGameDto>>;
export declare class UpdateGameDto extends UpdateGameDto_base {
    status?: GameStatus;
    finishedAt?: Date;
}
export {};
