import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { RealtimeService } from '../realtime/realtime.service.js';

// The columns anyone may see. `select` = "only bring back these", so the password never leaves the DB.
export const PUBLIC_USER = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  isBot: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findMe(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...PUBLIC_USER, email: true, theme: true, statusMode: true }, // my own email + theme are fine to show to me
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async updateMe(id: number, body: UpdateProfileDto) {
    // New username? Make sure nobody else has it → 409 Conflict
    if (body.username !== undefined) {
      const taken = await this.prisma.user.findFirst({
        where: { username: body.username, id: { not: id } },
      });
      if (taken) throw new ConflictException('That username is already taken!');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        username: body.username, // undefined = leave it unchanged
        // empty text → null, so "no display name" is stored as nothing
        displayName: body.displayName === undefined ? undefined : body.displayName.trim() || null,
        bio: body.bio === undefined ? undefined : body.bio.trim() || null,
        theme: body.theme, // "grey" or "black" (the DTO allows nothing else)
        statusMode: body.statusMode, // "auto", "online", "away" or "offline"
      },
      select: { ...PUBLIC_USER, email: true, theme: true, statusMode: true },
    });
    if (body.statusMode) await this.realtime.setMode(id, body.statusMode); // people see the new status live
    return user;
  }

  async findPublic(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: PUBLIC_USER });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }
}
