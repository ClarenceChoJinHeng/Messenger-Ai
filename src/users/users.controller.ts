import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

// Every /users route needs a logged-in user
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me → my own profile (includes my email)
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.usersService.findMe(user.sub);
  }

  // PATCH /users/me → change my display name / bio
  @Patch('me')
  updateMe(@CurrentUser() user: JwtUser, @Body() body: UpdateProfileDto) {
    return this.usersService.updateMe(user.sub, body);
  }

  // GET /users/:username → someone's public profile (exact username only: there's no list of everyone)
  @Get(':username')
  byUsername(@Param('username') username: string) {
    return this.usersService.findPublic(username);
  }
}
