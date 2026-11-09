import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';

@Module({
  providers: [AiService],
  exports: [AiService], // MessagesModule uses it
})
export class AiModule {}
