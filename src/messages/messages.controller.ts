import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MAX_UPLOAD_BYTES, MessagesService } from './messages.service.js';
import { EditMessageDto, ReactDto, SendMessageDto } from './dto/send-message.dto.js';
import type { UploadedFileData } from '../crypto/file-store.service.js';

@UseGuards(AuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // GET /messages/conversations → my chats, newest first, with last message, unread count, and isRequest
  @Get('conversations')
  conversations(@CurrentUser() user: JwtUser) {
    return this.messagesService.conversations(user.sub);
  }

  // GET /messages/attachment/:messageId → the photo/video/voice note, decrypted, only for the 2 people in that chat
  @Get('attachment/:messageId')
  async attachment(@CurrentUser() user: JwtUser, @Param('messageId', ParseIntPipe) messageId: number) {
    const file = await this.messagesService.attachment(user.sub, messageId);
    return new StreamableFile(file.data, { type: file.mime, length: file.data.length, disposition: 'inline' });
  }

  // PATCH /messages/item/:messageId → edit my message's text (within 15 minutes)
  @Patch('item/:messageId')
  edit(@CurrentUser() user: JwtUser, @Param('messageId', ParseIntPipe) messageId: number, @Body() body: EditMessageDto) {
    return this.messagesService.edit(user.sub, messageId, body.content);
  }

  // DELETE /messages/item/:messageId → unsend my message (it becomes "This message was deleted")
  @Delete('item/:messageId')
  unsend(@CurrentUser() user: JwtUser, @Param('messageId', ParseIntPipe) messageId: number) {
    return this.messagesService.unsend(user.sub, messageId);
  }

  // PUT /messages/item/:messageId/reaction { emoji } → react (same emoji again removes it)
  @Put('item/:messageId/reaction')
  react(@CurrentUser() user: JwtUser, @Param('messageId', ParseIntPipe) messageId: number, @Body() body: ReactDto) {
    return this.messagesService.react(user.sub, messageId, body.emoji);
  }

  // GET /messages/:userId → every message between me and that user (and marks theirs as read)
  @Get(':userId')
  thread(@CurrentUser() user: JwtUser, @Param('userId', ParseIntPipe) userId: number) {
    return this.messagesService.thread(user.sub, userId);
  }

  // POST /messages/:userId → send text and/or one file (multipart field "file"), optionally as a reply
  @Post(':userId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  send(
    @CurrentUser() user: JwtUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: SendMessageDto,
    @UploadedFile() file?: UploadedFileData,
  ) {
    const replyToId = body.replyToId ? Number(body.replyToId) : undefined;
    return this.messagesService.send(user.sub, userId, body.content ?? '', file, replyToId);
  }
}
