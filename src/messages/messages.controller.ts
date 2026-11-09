import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@UseGuards(AuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // GET /messages/conversations → my chats, newest first, with the last message
  @Get('conversations')
  conversations(@CurrentUser() user: JwtUser) {
    return this.messagesService.conversations(user.sub);
  }

  // GET /messages/:userId → every message between me and that user
  // ParseIntPipe turns the "5" from the URL into the number 5 (or answers 400)
  @Get(':userId')
  thread(@CurrentUser() user: JwtUser, @Param('userId', ParseIntPipe) userId: number) {
    return this.messagesService.thread(user.sub, userId);
  }

  // POST /messages/:userId → send a message (the AI answers in the same response)
  @Post(':userId')
  send(
    @CurrentUser() user: JwtUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: SendMessageDto,
  ) {
    return this.messagesService.send(user.sub, userId, body.content);
  }
}
