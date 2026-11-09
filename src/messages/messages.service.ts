import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { AiService } from '../ai/ai.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PUBLIC_USER } from '../users/users.service.js';
import type { Message } from '../generated/prisma/client.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

// Only these kinds of files. We check the file's real bytes, not the name or what the browser claims.
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// The parts of an uploaded file we use (filled in by Nest's FileInterceptor)
export interface UploadedFileData {
  buffer: Buffer;
  size: number;
}

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
    private readonly crypto: CryptoService,
    private readonly ai: AiService,
    private readonly realtime: RealtimeService, // pushes live events to open browser tabs
    private readonly notifications: NotificationsService,
  ) {}

  // What the frontend gets: decrypted text, and attachment info without the secret file name
  private toPublic(m: Message) {
    return {
      id: m.id,
      content: this.crypto.decryptText(m.content),
      senderId: m.senderId,
      receiverId: m.receiverId,
      readAt: m.readAt,
      createdAt: m.createdAt,
      attachment: m.attachmentFile ? { mime: m.attachmentMime!, size: m.attachmentSize! } : null,
    };
  }

  async conversations(myId: number) {
    // Newest messages that involve me (enough for a small app)
    const recent = await this.prisma.message.findMany({
      where: { OR: [{ senderId: myId }, { receiverId: myId }] },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Keep only the newest message per chat partner
    const lastByPartner = new Map<number, Message>();
    for (const m of recent) {
      const partnerId = m.senderId === myId ? m.receiverId : m.senderId;
      if (!lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
    }

    const [partners, unread] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: [...lastByPartner.keys()] } }, select: PUBLIC_USER }),
      // How many messages each person sent me that I haven't opened yet
      this.prisma.message.groupBy({
        by: ['senderId'],
        where: { receiverId: myId, readAt: null },
        _count: { _all: true },
      }),
    ]);

    // Same order as lastByPartner: newest chat first
    return [...lastByPartner.entries()].flatMap(([partnerId, lastMessage]) => {
      const user = partners.find((p) => p.id === partnerId);
      const unreadCount = unread.find((u) => u.senderId === partnerId)?._count._all ?? 0;
      return user ? [{ user, lastMessage: this.toPublic(lastMessage), unreadCount }] : [];
    });
  }

  async thread(myId: number, otherId: number) {
    await this.findPartner(myId, otherId);

    // Opening the chat = I've read everything they sent me
    const { count } = await this.prisma.message.updateMany({
      where: { senderId: otherId, receiverId: myId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count) {
      this.realtime.emitToUser(otherId, 'read', { by: myId }); // their "Sent" turns into "Seen" instantly
      await this.notifications.readChat(myId, otherId); // and the bell forgets these messages
    }

    // Newest 200, then flip so the oldest is at the top of the chat
    const messages = await this.prisma.message.findMany({
      where: between(myId, otherId),
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return messages.reverse().map((m) => this.toPublic(m));
  }

  async send(myId: number, otherId: number, content: string, file?: UploadedFileData) {
    const text = content.trim();
    if (!text && !file) throw new BadRequestException('Message cannot be empty!');
    const partner = await this.findPartner(myId, otherId);

    const attachment = file ? await this.saveAttachment(file) : null;
    const sent = await this.prisma.message.create({
      data: {
        senderId: myId,
        receiverId: otherId,
        content: this.crypto.encryptText(text), // stored encrypted
        attachmentFile: attachment?.fileName,
        attachmentMime: attachment?.mime,
        attachmentSize: attachment?.size,
      },
    });

    const sentPublic = this.toPublic(sent);
    // Push it live to both people's open tabs (the sender may have the chat open elsewhere too)
    this.realtime.emitToUser(otherId, 'message', sentPublic);
    this.realtime.emitToUser(myId, 'message', sentPublic);

    // Talking to a human: add it to their bell, and we're done
    if (!partner.isBot) {
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: myId }, select: { username: true, displayName: true } });
      const preview = text || (attachment?.mime.startsWith('video') ? '🎬 Video' : '📷 Photo');
      await this.notifications.message(otherId, { id: myId, name: me.displayName || me.username }, preview);
      return { sent: sentPublic, reply: null };
    }

    // Talking to the AI: give it the recent chat, save its answer as a message from the bot
    const history = (await this.thread(myId, otherId)).slice(-20);
    const replyText = await this.ai.reply(
      history.map((m) => ({
        fromUser: m.senderId === myId,
        content: [m.attachment && `[sent a ${m.attachment.mime.startsWith('video') ? 'video' : 'photo'}]`, m.content]
          .filter(Boolean)
          .join(' '),
      })),
    );
    const reply = await this.prisma.message.create({
      data: { senderId: otherId, receiverId: myId, content: this.crypto.encryptText(replyText), readAt: new Date() },
    });
    const replyPublic = this.toPublic(reply);
    this.realtime.emitToUser(myId, 'message', replyPublic);
    return { sent: sentPublic, reply: replyPublic };
  }

  async attachment(myId: number, messageId: number) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    // Same answer for "doesn't exist" and "not your chat", so ids can't be probed
    if (!message?.attachmentFile || (message.senderId !== myId && message.receiverId !== myId)) {
      throw new NotFoundException('File not found.');
    }
    const encrypted = await readFile(join(UPLOAD_DIR, message.attachmentFile));
    return { data: this.crypto.decryptBuffer(encrypted), mime: message.attachmentMime! };
  }

  private async saveAttachment(file: UploadedFileData) {
    const found = await fileTypeFromBuffer(file.buffer);
    // Camera recordings from the browser are WebM, which some tools report as its parent format, Matroska
    const detected = found?.mime === 'video/x-matroska' ? { mime: 'video/webm' } : found;
    if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
      throw new BadRequestException('Only photos (JPG, PNG, GIF, WebP) and videos (MP4, WebM, MOV) can be sent.');
    }
    // A random name: the user's file name never touches the disk (no path tricks)
    const fileName = `${randomUUID()}.bin`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, fileName), this.crypto.encryptBuffer(file.buffer)); // encrypted on disk
    return { fileName, mime: detected.mime, size: file.size };
  }

  private async findPartner(myId: number, otherId: number) {
    if (myId === otherId) throw new BadRequestException("You can't message yourself.");
    const partner = await this.prisma.user.findUnique({ where: { id: otherId }, select: PUBLIC_USER });
    if (!partner) throw new NotFoundException('User not found.');
    return partner;
  }
}
