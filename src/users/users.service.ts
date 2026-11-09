import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { FileStoreService, IMAGE_TYPES, type UploadedFileData } from '../crypto/file-store.service.js';

// The columns anyone may see. `select` = "only bring back these", so the password never leaves the DB.
export const PUBLIC_USER = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  isBot: true,
  avatarKey: true, // null = no profile photo; changes whenever the photo changes
  createdAt: true,
} as const;

const ME = { ...PUBLIC_USER, email: true, theme: true, statusMode: true } as const; // extra fields only I see

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly files: FileStoreService,
  ) {}

  async findMe(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: ME });
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
      select: ME,
    });
    if (body.statusMode) await this.realtime.setMode(id, body.statusMode); // people see the new status live
    if (body.username !== undefined || body.displayName !== undefined || body.bio !== undefined) await this.announce(id);
    return user;
  }

  async findPublic(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: PUBLIC_USER });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  // ---- profile photo ----

  async setAvatar(id: number, file: UploadedFileData) {
    const saved = await this.files.save(file, IMAGE_TYPES, 'Profile photos must be JPG, PNG, GIF or WebP.');
    const old = await this.prisma.user.findUnique({ where: { id }, select: { avatarFile: true } });
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarFile: saved.fileName, avatarMime: saved.mime, avatarKey: randomUUID().slice(0, 8) },
      select: ME,
    });
    await this.files.remove(old?.avatarFile);
    await this.announce(id);
    return user;
  }

  async removeAvatar(id: number) {
    const old = await this.prisma.user.findUnique({ where: { id }, select: { avatarFile: true } });
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarFile: null, avatarMime: null, avatarKey: null },
      select: ME,
    });
    await this.files.remove(old?.avatarFile);
    await this.announce(id);
    return user;
  }

  async avatar(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { avatarFile: true, avatarMime: true } });
    if (!user?.avatarFile) throw new NotFoundException('No profile photo.');
    return { data: await this.files.read(user.avatarFile), mime: user.avatarMime! };
  }

  // Name/photo changed: people who have me in their list refresh it
  private async announce(id: number) {
    for (const other of await this.realtime.audienceOf(id)) this.realtime.emitToUser(other, 'contacts', {});
    this.realtime.emitToUser(id, 'contacts', {});
  }
}
