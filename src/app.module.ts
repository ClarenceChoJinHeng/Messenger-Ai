import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { AiModule } from './ai/ai.module.js';

// The root module: lists every feature module the app is made of
@Module({
  imports: [PrismaModule, AuthModule, UsersModule, MessagesModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
