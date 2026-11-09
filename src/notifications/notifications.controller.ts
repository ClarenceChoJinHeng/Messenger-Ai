import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /notifications → { unread, items } (newest 30)
  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.notifications.list(user.sub);
  }

  // POST /notifications/read-all
  @Post('read-all')
  @HttpCode(204)
  readAll(@CurrentUser() user: JwtUser) {
    return this.notifications.readAll(user.sub);
  }

  // POST /notifications/:id/read
  @Post(':id/read')
  @HttpCode(204)
  read(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.read(user.sub, id);
  }
}
