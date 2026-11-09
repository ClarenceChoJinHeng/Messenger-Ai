import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ContactsService } from './contacts.service.js';
import { AddContactDto } from './add-contact.dto.js';

@UseGuards(AuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // GET /contacts → my chat list: Sparky, people I added, and anyone who messaged me
  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.contactsService.list(user.sub);
  }

  // POST /contacts { username } → add someone by their exact username
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // stops guessing usernames at full speed
  add(@CurrentUser() user: JwtUser, @Body() body: AddContactDto) {
    return this.contactsService.add(user.sub, body.username);
  }

  // DELETE /contacts/:userId → remove from my list (the messages stay)
  @Delete(':userId')
  @HttpCode(204) // 204 No Content: done, nothing to send back
  remove(@CurrentUser() user: JwtUser, @Param('userId', ParseIntPipe) userId: number) {
    return this.contactsService.remove(user.sub, userId);
  }
}
