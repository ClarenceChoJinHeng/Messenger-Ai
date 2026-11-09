import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MAX_UPLOAD_BYTES, MessagesService, type UploadedFileData } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@UseGuards(AuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // GET /messages/conversations → my chats, newest first, with the last message + unread count
  @Get('conversations')
  conversations(@CurrentUser() user: JwtUser) {
    return this.messagesService.conversations(user.sub);
  }

  // GET /messages/attachment/:messageId → the photo/video, decrypted, only for the 2 people in that chat
  @Get('attachment/:messageId')
  async attachment(@CurrentUser() user: JwtUser, @Param('messageId', ParseIntPipe) messageId: number) {
    const file = await this.messagesService.attachment(user.sub, messageId);
    return new StreamableFile(file.data, { type: file.mime, length: file.data.length, disposition: 'inline' });
  }

  // GET /messages/:userId → every message between me and that user (and marks theirs as read)
  // ParseIntPipe turns the "5" from the URL into the number 5 (or answers 400)
  @Get(':userId')
  thread(@CurrentUser() user: JwtUser, @Param('userId', ParseIntPipe) userId: number) {
    return this.messagesService.thread(user.sub, userId);
  }

  // POST /messages/:userId → send text and/or one photo/video (multipart form, field "file")
  @Post(':userId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  send(
    @CurrentUser() user: JwtUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: SendMessageDto,
    @UploadedFile() file?: UploadedFileData,
  ) {
    return this.messagesService.send(user.sub, userId, body.content ?? '', file);
  }
}
