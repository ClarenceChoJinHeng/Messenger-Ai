import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AccountService } from './account.service.js';
import { ChangeEmailDto, ChangePasswordDto, ConfirmChangeDto } from './account.dto.js';

// Changing email or password: ask here, then confirm with the link we email you
@Controller('account')
@Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 a minute: stops password guessing and email spam
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // POST /account/email → emails a confirmation link to the NEW address
  @Post('email')
  @HttpCode(202) // 202 Accepted: "got it, it happens once you click the link"
  @UseGuards(AuthGuard)
  requestEmail(@CurrentUser() user: JwtUser, @Body() body: ChangeEmailDto) {
    return this.accountService.requestEmailChange(user.sub, body);
  }

  // POST /account/password → emails a confirmation link to your CURRENT address
  @Post('password')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  requestPassword(@CurrentUser() user: JwtUser, @Body() body: ChangePasswordDto) {
    return this.accountService.requestPasswordChange(user.sub, body);
  }

  // POST /account/confirm → the link in the email lands here. No login needed: the token proves it
  @Post('confirm')
  @HttpCode(200)
  confirm(@Body() body: ConfirmChangeDto) {
    return this.accountService.confirm(body.token);
  }
}
