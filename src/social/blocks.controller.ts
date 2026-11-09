import { BadRequestException, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, type JwtUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { PUBLIC_USER } from '../users/users.service.js';

@UseGuards(AuthGuard)
@Controller('blocks')
export class BlocksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // GET /blocks → the people I blocked (for Profile → Blocked people)
  @Get()
  async list(@CurrentUser() me: JwtUser) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: me.sub },
      include: { blocked: { select: PUBLIC_USER } },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((b) => b.blocked);
  }

  // POST /blocks/:userId → block someone
  @Post(':userId')
  @HttpCode(204)
  async block(@CurrentUser() me: JwtUser, @Param('userId', ParseIntPipe) userId: number) {
    if (userId === me.sub) throw new BadRequestException("You can't block yourself.");
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBot: true } });
    if (!target) throw new NotFoundException('User not found.');
    if (target.isBot) throw new BadRequestException("Sparky can't be blocked.");
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.sub, blockedId: userId } },
      update: {},
      create: { blockerId: me.sub, blockedId: userId },
    });
    this.changed(me.sub, userId);
  }

  // DELETE /blocks/:userId → unblock
  @Delete(':userId')
  @HttpCode(204)
  async unblock(@CurrentUser() me: JwtUser, @Param('userId', ParseIntPipe) userId: number) {
    await this.prisma.block.deleteMany({ where: { blockerId: me.sub, blockedId: userId } });
    this.changed(me.sub, userId);
  }

  // Both people's chat lists change (the other side just sees you go "offline")
  private changed(a: number, b: number) {
    this.realtime.emitToUser(a, 'contacts', {});
    this.realtime.emitToUser(b, 'contacts', {});
  }
}
