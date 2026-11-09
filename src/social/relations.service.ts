import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Everything about how I relate to other people, worked out in one place:
//   contacts   - people I added
//   iBlocked   - people I blocked (hidden from my lists)
//   blockedMe  - people who blocked me (they look offline, and I can't message them)
//   requests   - strangers who messaged me: not my contact, and I've never written to them
//   hidden     - requests I deleted (until they send something newer)
export interface MyRelations {
  contacts: Set<number>;
  iBlocked: Set<number>;
  blockedMe: Set<number>;
  sentTo: Set<number>;
  receivedFrom: Set<number>;
  requests: Set<number>;
  hidden: Set<number>;
}

@Injectable()
export class RelationsService {
  constructor(private readonly prisma: PrismaService) {}

  async of(myId: number): Promise<MyRelations> {
    const [contacts, blocks, sentTo, received, dismissals] = await Promise.all([
      this.prisma.contact.findMany({ where: { ownerId: myId }, select: { contactId: true } }),
      this.prisma.block.findMany({ where: { OR: [{ blockerId: myId }, { blockedId: myId }] } }),
      this.prisma.message.groupBy({ by: ['receiverId'], where: { senderId: myId } }),
      this.prisma.message.groupBy({ by: ['senderId'], where: { receiverId: myId }, _max: { createdAt: true } }),
      this.prisma.dismissedRequest.findMany({ where: { userId: myId } }),
    ]);

    const r: MyRelations = {
      contacts: new Set(contacts.map((c) => c.contactId)),
      iBlocked: new Set(blocks.filter((b) => b.blockerId === myId).map((b) => b.blockedId)),
      blockedMe: new Set(blocks.filter((b) => b.blockedId === myId).map((b) => b.blockerId)),
      sentTo: new Set(sentTo.map((m) => m.receiverId)),
      receivedFrom: new Set(received.map((m) => m.senderId)),
      requests: new Set(),
      hidden: new Set(),
    };

    const dismissedAt = new Map(dismissals.map((d) => [d.fromId, d.dismissedAt]));
    for (const m of received) {
      const from = m.senderId;
      if (r.contacts.has(from) || r.sentTo.has(from)) continue; // a normal chat
      const dismissed = dismissedAt.get(from);
      if (dismissed && m._max.createdAt && m._max.createdAt <= dismissed) r.hidden.add(from); // deleted, nothing new
      else r.requests.add(from);
    }
    for (const id of r.iBlocked) r.hidden.add(id);
    return r;
  }

  // Is there a block in either direction?
  async blockedEitherWay(a: number, b: number): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
      select: { id: true },
    });
    return !!block;
  }

  // Would a message from `fromId` land in `toId`'s Requests (instead of their chats)?
  async isRequestFor(toId: number, fromId: number): Promise<boolean> {
    const [contact, replied] = await Promise.all([
      this.prisma.contact.findUnique({ where: { ownerId_contactId: { ownerId: toId, contactId: fromId } }, select: { id: true } }),
      this.prisma.message.findFirst({ where: { senderId: toId, receiverId: fromId }, select: { id: true } }),
    ]);
    return !contact && !replied;
  }
}
