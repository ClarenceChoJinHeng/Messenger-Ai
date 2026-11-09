import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { PUBLIC_USER } from '../users/users.service.js';

// "messages between A and B" = A sent to B, or B sent to A
const between = (a: number, b: number) => ({
  OR: [
    { senderId: a, receiverId: b },
    { senderId: b, receiverId: a },
  ],
});

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async conversations(myId: number) {
    // Newest messages that involve me (enough for a small app)
    const recent = await this.prisma.message.findMany({
      where: { OR: [{ senderId: myId }, { receiverId: myId }] },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Keep only the newest message per chat partner
    const lastByPartner = new Map<number, (typeof recent)[number]>();
    for (const m of recent) {
      const partnerId = m.senderId === myId ? m.receiverId : m.senderId;
      if (!lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
    }

    const partners = await this.prisma.user.findMany({
      where: { id: { in: [...lastByPartner.keys()] } },
      select: PUBLIC_USER,
    });

    // Same order as lastByPartner: newest chat first
    return [...lastByPartner.entries()].flatMap(([partnerId, lastMessage]) => {
      const user = partners.find((p) => p.id === partnerId);
      return user ? [{ user, lastMessage }] : [];
    });
  }

  async thread(myId: number, otherId: number) {
    await this.findPartner(myId, otherId);
    // Newest 200, then flip so the oldest is at the top of the chat
    const messages = await this.prisma.message.findMany({
      where: between(myId, otherId),
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return messages.reverse();
  }

  async send(myId: number, otherId: number, content: string) {
    const partner = await this.findPartner(myId, otherId);

    const sent = await this.prisma.message.create({
      data: { senderId: myId, receiverId: otherId, content: content.trim() },
    });

    // Talking to a human: done
    if (!partner.isBot) return { sent, reply: null };

    // Talking to the AI: give it the recent chat, save its answer as a message from the bot
    const history = (await this.thread(myId, otherId)).slice(-20);
    const replyText = await this.ai.reply(
      history.map((m) => ({ fromUser: m.senderId === myId, content: m.content })),
    );
    const reply = await this.prisma.message.create({
      data: { senderId: otherId, receiverId: myId, content: replyText },
    });
    return { sent, reply };
  }

  private async findPartner(myId: number, otherId: number) {
    if (myId === otherId) throw new BadRequestException("You can't message yourself.");
    const partner = await this.prisma.user.findUnique({ where: { id: otherId }, select: PUBLIC_USER });
    if (!partner) throw new NotFoundException('User not found.');
    return partner;
  }
}
