import { Global, Module } from '@nestjs/common';
import { RelationsService } from './relations.service.js';
import { BlocksController } from './blocks.controller.js';

// Global: contacts, messages and the live connection all need to know about blocks and requests
@Global()
@Module({
  controllers: [BlocksController],
  providers: [RelationsService],
  exports: [RelationsService],
})
export class SocialModule {}
