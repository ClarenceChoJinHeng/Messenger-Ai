import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

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
  constructor(private readonly prisma: PrismaService) {}

  async findMe(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...PUBLIC_USER, email: true }, // my own email is fine to show to me
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  updateMe(id: number, body: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id },
      // empty text → null, so "no display name" is stored as nothing
      data: { displayName: body.displayName?.trim() || null, bio: body.bio?.trim() || null },
      select: { ...PUBLIC_USER, email: true },
    });
  }

  listOthers(myId: number) {
    return this.prisma.user.findMany({
      where: { id: { not: myId } },
      select: PUBLIC_USER,
      orderBy: [{ isBot: 'desc' }, { username: 'asc' }], // the AI on top, then A→Z
    });
  }

  async findPublic(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: PUBLIC_USER });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }
}
