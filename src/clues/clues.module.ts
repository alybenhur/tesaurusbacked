import { Module } from '@nestjs/common';
import { CluesService } from './clues.service';
import { CluesController } from './clues.controller';

@Module({
  providers: [CluesService],
  controllers: [CluesController]
})
export class CluesModule {}
