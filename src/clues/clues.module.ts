import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CluesService } from './clues.service';
import { CluesController } from './clues.controller';
import { Clue, ClueSchema } from './schemas/clue.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clue.name, schema: ClueSchema }
    ])
  ],
  controllers: [CluesController],
  providers: [CluesService],
  exports: [CluesService]
})
export class CluesModule {}