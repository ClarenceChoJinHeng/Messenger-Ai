import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUBLIC_USER } from '../users/users.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(myId: number) {
    const [added, sentTo, receivedFrom] = await Promise.all([
      this.prisma.contact.findMany({ where: { ownerId: myId }, select: { contactId: true } }),
      // everyone I've ever messaged, and everyone who ever messaged me
      this.prisma.message.groupBy({ by: ['receiverId'], where: { senderId: myId } }),
      this.prisma.message.groupBy({ by: ['senderId'], where: { receiverId: myId } }),
    ]);

    const contactIds = new Set(added.map((c) => c.contactId));
    const ids = new Set([...contactIds, ...sentTo.map((m) => m.receiverId), ...receivedFrom.map((m) => m.senderId)]);
    ids.delete(myId);

    const users = await this.prisma.user.findMany({
      where: { OR: [{ id: { in: [...ids] } }, { isBot: true }] }, // Sparky is always in the list
      select: { ...PUBLIC_USER, statusMode: true, lastSeenAt: true },
      orderBy: [{ isBot: 'desc' }, { username: 'asc' }],
    });
    // isContact = false for someone who messaged me but I haven't added (the UI offers an "Add" button).
    // presence = what they show as (online/away/offline + last seen). Their private setting stays private.
    return users.map(({ statusMode, lastSeenAt, ...u }) => ({
      ...u,
      isContact: u.isBot || contactIds.has(u.id),
      presence: this.realtime.publicPresence({ id: u.id, isBot: u.isBot, statusMode, lastSeenAt }),
    }));
  }

  async add(myId: number, rawUsername: string) {
    const username = rawUsername.trim().replace(/^@/, '');
    const user = await this.prisma.user.findUnique({ where: { username }, select: PUBLIC_USER });
    if (!user) throw new NotFoundException(`Nobody is called "${username}". Check the spelling.`);
    if (user.id === myId) throw new BadRequestException("That's you! Add someone else.");
    if (user.isBot) return { ...user, isContact: true }; // Sparky is already in everyone's list

    const already = await this.prisma.contact.findUnique({
      where: { ownerId_contactId: { ownerId: myId, contactId: user.id } },
    });
    // upsert: adding someone twice is fine, it just keeps the one row
    await this.prisma.contact.upsert({
      where: { ownerId_contactId: { ownerId: myId, contactId: user.id } },
      update: {},
      create: { ownerId: myId, contactId: user.id },
    });
    if (!already) {
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: myId }, select: { username: true, displayName: true } });
      const name = me.displayName || me.username;
      await this.notifications.add(user.id, 'contact', `${name} added you`, `@${me.username} can now message you.`, `/chat?with=${myId}`, myId);
    }
    return { ...user, isContact: true };
  }

  async remove(myId: number, userId: number) {
    await this.prisma.contact.deleteMany({ where: { ownerId: myId, contactId: userId } });
  }
}
