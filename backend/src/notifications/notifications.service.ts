import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import type { Notification } from '../generated/prisma/client.js';

type NotificationType = 'message' | 'contact' | 'security' | 'reaction';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly realtime: RealtimeService,
  ) {}

  private toPublic(n: Notification) {
    return {
      id: n.id,
      type: n.type,
      actorId: n.actorId,
      title: n.title,
      body: this.crypto.decryptText(n.body),
      link: n.link,
      count: n.count,
      readAt: n.readAt,
      updatedAt: n.updatedAt,
    };
  }

  async list(userId: number) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 30 }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { unread, items: items.map((n) => this.toPublic(n)) };
  }

  // A new message: group it with the sender's other unread messages ("3 new messages")
  async message(receiverId: number, sender: { id: number; name: string }, preview: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { userId: receiverId, type: 'message', actorId: sender.id, readAt: null },
    });
    const body = this.crypto.encryptText(preview.slice(0, 200));
    if (existing) {
      await this.prisma.notification.update({
        where: { id: existing.id },
        data: { count: { increment: 1 }, body, title: sender.name },
      });
    } else {
      await this.prisma.notification.create({
        data: { userId: receiverId, type: 'message', actorId: sender.id, title: sender.name, body, link: `/chat?with=${sender.id}` },
      });
    }
    this.changed(receiverId);
  }

  // Someone reacted to my message. Changing the emoji again updates the same notification (no spam).
  async reaction(ownerId: number, actor: { id: number; name: string }, messageId: number, emoji: string, preview: string) {
    const link = `/chat?with=${actor.id}&m=${messageId}`; // one notification per message per person
    const title = `${actor.name} reacted ${emoji}`;
    const body = this.crypto.encryptText(`to: ${preview.slice(0, 160)}`);
    const existing = await this.prisma.notification.findFirst({ where: { userId: ownerId, type: 'reaction', actorId: actor.id, link, readAt: null } });
    if (existing) await this.prisma.notification.update({ where: { id: existing.id }, data: { title, body } });
    else await this.prisma.notification.create({ data: { userId: ownerId, type: 'reaction', actorId: actor.id, title, body, link } });
    this.changed(ownerId);
  }

  // The reaction was taken back: take back its (unread) notification too
  async removeReaction(ownerId: number, actorId: number, messageId: number) {
    const { count } = await this.prisma.notification.deleteMany({
      where: { userId: ownerId, type: 'reaction', actorId, link: `/chat?with=${actorId}&m=${messageId}`, readAt: null },
    });
    if (count) this.changed(ownerId);
  }

  async add(userId: number, type: NotificationType, title: string, body: string, link?: string, actorId?: number) {
    await this.prisma.notification.create({
      data: { userId, type, title, body: this.crypto.encryptText(body), link, actorId },
    });
    this.changed(userId);
  }

  // A message was unsent: don't leave its text in the receiver's bell
  async retract(userId: number, actorId: number) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, type: 'message', actorId, readAt: null },
      data: { body: this.crypto.encryptText('🚫 A message was deleted') },
    });
    if (count) this.changed(userId);
  }

  // Opening a chat clears that person's message notifications
  async readChat(userId: number, actorId: number) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, type: 'message', actorId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count) this.changed(userId);
  }

  async read(userId: number, id: number) {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    this.changed(userId);
  }

  async readAll(userId: number) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    this.changed(userId);
  }

  // Tell the user's open tabs to refresh the bell
  private changed(userId: number) {
    this.realtime.emitToUser(userId, 'notifications', {});
  }
}
