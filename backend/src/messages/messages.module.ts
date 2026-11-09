import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { AiModule } from '../ai/ai.module.js';
import { AiController } from '../ai/ai.controller.js';

@Module({
  imports: [AiModule], // so MessagesService can ask the AI for a reply
  controllers: [MessagesController, AiController], // /ai routes use MessagesService (chat history)
  providers: [MessagesService],
})
export class MessagesModule {}
