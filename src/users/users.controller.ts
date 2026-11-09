import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UploadedFileData } from '../crypto/file-store.service.js';

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

  // PATCH /users/me → change my username / display name / bio / theme / status
  @Patch('me')
  updateMe(@CurrentUser() user: JwtUser, @Body() body: UpdateProfileDto) {
    return this.usersService.updateMe(user.sub, body);
  }

  // POST /users/me/avatar → upload a profile photo (multipart, field "file", max 5 MB)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  setAvatar(@CurrentUser() user: JwtUser, @UploadedFile() file?: UploadedFileData) {
    if (!file) throw new BadRequestException('Choose a photo to upload.');
    return this.usersService.setAvatar(user.sub, file);
  }

  // DELETE /users/me/avatar → remove my profile photo
  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: JwtUser) {
    return this.usersService.removeAvatar(user.sub);
  }

  // GET /users/:id/avatar → someone's profile photo (decrypted). The URL carries ?k=<avatarKey>,
  // so the browser may cache it: a new photo gets a new key, and so a new URL.
  @Get(':id/avatar')
  @Header('Cache-Control', 'private, max-age=604800')
  async avatar(@Param('id', ParseIntPipe) id: number) {
    const photo = await this.usersService.avatar(id);
    return new StreamableFile(photo.data, { type: photo.mime, length: photo.data.length, disposition: 'inline' });
  }

  // GET /users/:username → someone's public profile (exact username only: there's no list of everyone)
  @Get(':username')
  byUsername(@Param('username') username: string) {
    return this.usersService.findPublic(username);
  }
}
