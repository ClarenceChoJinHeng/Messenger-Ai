import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MessagesService } from '../messages/messages.service.js';
import { AiService } from './ai.service.js';

// POST /ai/assist: what to do in a chat with a friend
class AssistDto {
  @IsInt()
  partnerId: number;

  @IsIn(['summarize', 'suggest', 'translate'])
  action: 'summarize' | 'suggest' | 'translate';

  @IsOptional()
  @IsInt()
  messageId?: number; // translate: which message

  @IsOptional()
  @IsString()
  @MaxLength(30)
  language?: string; // translate: into which language
}

@UseGuards(AuthGuard)
@Controller('ai')
@Throttle({ default: { limit: 20, ttl: 60_000 } }) // AI calls cost money: max 20 a minute per person
export class AiController {
  constructor(
    private readonly messages: MessagesService,
    private readonly ai: AiService,
  ) {}

  // GET /ai/status → is the real AI switched on? (no key = free "simple mode": the app hides the ✨ tools)
  @Get('status')
  status() {
    return { claude: this.ai.usesClaude };
  }

  // POST /ai/reset → "New conversation" with Sparky (it forgets earlier messages)
  @Post('reset')
  reset(@CurrentUser() user: JwtUser) {
    return this.messages.resetBotMemory(user.sub);
  }

  // POST /ai/assist → summary / reply suggestions / translation, only for the person asking
  @Post('assist')
  assist(@CurrentUser() user: JwtUser, @Body() body: AssistDto) {
    return this.messages.assist(user.sub, body.partnerId, body.action, body.messageId, body.language);
  }
}
