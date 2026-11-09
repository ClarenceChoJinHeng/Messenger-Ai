import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUBLIC_USER } from '../users/users.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RelationsService } from '../social/relations.service.js';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly relations: RelationsService,
  ) {}

  // My chat list: Sparky, people I added, people I've messaged, and message requests.
  // People I blocked and requests I deleted are left out.
  async list(myId: number) {
    const rel = await this.relations.of(myId);
    const ids = new Set([...rel.contacts, ...rel.sentTo, ...rel.receivedFrom]);
    for (const id of rel.hidden) ids.delete(id);
    ids.delete(myId);

    const users = await this.prisma.user.findMany({
      where: { OR: [{ id: { in: [...ids] } }, { isBot: true }] }, // Sparky is always in the list
      select: { ...PUBLIC_USER, statusMode: true, lastSeenAt: true },
      orderBy: [{ isBot: 'desc' }, { username: 'asc' }],
    });
    return users.map(({ statusMode, lastSeenAt, ...u }) => ({
      ...u,
      // isContact = false for someone who messaged me but I haven't added (the UI offers "Add")
      isContact: u.isBot || rel.contacts.has(u.id),
      // isRequest = a stranger's message waiting in my Requests tab
      isRequest: rel.requests.has(u.id),
      // what they show as. Someone who blocked me just looks offline, with no "last seen".
      presence: rel.blockedMe.has(u.id)
        ? { status: 'offline' as const, lastSeenAt: null }
        : this.realtime.publicPresence({ id: u.id, isBot: u.isBot, statusMode, lastSeenAt }),
    }));
  }

  // Add someone by exact username (also how you accept a message request)
  async add(myId: number, rawUsername: string) {
    const username = rawUsername.trim().replace(/^@/, '');
    const user = await this.prisma.user.findUnique({ where: { username }, select: PUBLIC_USER });
    const notFound = new NotFoundException(`Nobody is called "${username}". Check the spelling.`);
    if (!user) throw notFound;
    if (user.id === myId) throw new BadRequestException("That's you! Add someone else.");
    if (user.isBot) return { ...user, isContact: true }; // Sparky is already in everyone's list

    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: myId, blockedId: user.id }, { blockerId: user.id, blockedId: myId }] },
    });
    if (blocks.some((b) => b.blockerId === user.id)) throw notFound; // they blocked me: they don't show up in search
    if (blocks.length) throw new BadRequestException('You blocked this person. Unblock them first in Profile → Blocked people.');

    const already = await this.prisma.contact.findUnique({
      where: { ownerId_contactId: { ownerId: myId, contactId: user.id } },
    });
    // upsert: adding someone twice is fine, it just keeps the one row
    await this.prisma.contact.upsert({
      where: { ownerId_contactId: { ownerId: myId, contactId: user.id } },
      update: {},
      create: { ownerId: myId, contactId: user.id },
    });
    await this.prisma.dismissedRequest.deleteMany({ where: { userId: myId, fromId: user.id } });

    if (!already) {
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: myId }, select: { username: true, displayName: true } });
      const name = me.displayName || me.username;
      await this.notifications.add(user.id, 'contact', `${name} added you`, `@${me.username} can now message you.`, `/chat?with=${myId}`, myId);
    }
    this.realtime.emitToUser(myId, 'contacts', {});
    return { ...user, isContact: true };
  }

  async remove(myId: number, userId: number) {
    await this.prisma.contact.deleteMany({ where: { ownerId: myId, contactId: userId } });
    this.realtime.emitToUser(myId, 'contacts', {});
  }

  // Delete a message request: hidden until they send something newer
  async dismissRequest(myId: number, fromId: number) {
    await this.prisma.dismissedRequest.upsert({
      where: { userId_fromId: { userId: myId, fromId } },
      update: { dismissedAt: new Date() },
      create: { userId: myId, fromId },
    });
    this.realtime.emitToUser(myId, 'contacts', {});
  }
}
