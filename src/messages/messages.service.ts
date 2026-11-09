import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { AUDIO_TYPES, FileStoreService, IMAGE_TYPES, VIDEO_TYPES, type UploadedFileData } from '../crypto/file-store.service.js';
import { AiService, type AssistAction, type ChatTurn } from '../ai/ai.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RelationsService } from '../social/relations.service.js';
import { PUBLIC_USER } from '../users/users.service.js';
import type { Message } from '../generated/prisma/client.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];
const EDIT_WINDOW_MS = 15 * 60 * 1000; // like WhatsApp: you can edit for 15 minutes

// Every message query brings its reactions and the message it replies to
const WITH_EXTRAS = {
  reactions: { select: { emoji: true, userId: true } },
  replyTo: true,
} as const;
type FullMessage = Message & { reactions: { emoji: string; userId: number }[]; replyTo: Message | null };

// "messages between A and B" = A sent to B, or B sent to A
const between = (a: number, b: number) => ({
  OR: [
    { senderId: a, receiverId: b },
    { senderId: b, receiverId: a },
  ],
});

// What a file looks like in a preview
const labelOf = (mime: string) => (mime.startsWith('video') ? '🎬 Video' : mime.startsWith('audio') ? '🎤 Voice message' : '📷 Photo');

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly botQueue = new Map<number, Promise<unknown>>(); // per user: Sparky's reply in progress

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly files: FileStoreService,
    private readonly ai: AiService,
    private readonly realtime: RealtimeService, // pushes live events to open browser tabs
    private readonly notifications: NotificationsService,
    private readonly relations: RelationsService,
  ) {}

  private preview(m: Message) {
    if (m.deletedAt) return 'Deleted message';
    return this.crypto.decryptText(m.content) || (m.attachmentMime ? labelOf(m.attachmentMime) : '');
  }

  // What the frontend gets: decrypted text, reactions, the quoted reply, and attachment info
  // (never the secret file name). An unsent message keeps only its "shell".
  private toPublic(m: FullMessage) {
    const deleted = !!m.deletedAt;
    return {
      id: m.id,
      content: deleted ? '' : this.crypto.decryptText(m.content),
      senderId: m.senderId,
      receiverId: m.receiverId,
      readAt: m.readAt,
      editedAt: m.editedAt,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt,
      attachment: !deleted && m.attachmentFile ? { mime: m.attachmentMime!, size: m.attachmentSize! } : null,
      reactions: deleted ? [] : m.reactions,
      replyTo: !deleted && m.replyTo ? { id: m.replyTo.id, senderId: m.replyTo.senderId, preview: this.preview(m.replyTo) } : null,
    };
  }

  // Tell both people's open tabs that a message changed (edited, unsent, reacted to)
  private async emitUpdate(messageId: number) {
    const m = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId }, include: WITH_EXTRAS });
    const pub = this.toPublic(m);
    this.realtime.emitToUser(m.senderId, 'message:updated', pub);
    this.realtime.emitToUser(m.receiverId, 'message:updated', pub);
    return pub;
  }

  async conversations(myId: number) {
    // Newest messages that involve me (enough for a small app)
    const [recent, rel] = await Promise.all([
      this.prisma.message.findMany({
        where: { OR: [{ senderId: myId }, { receiverId: myId }] },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: WITH_EXTRAS,
      }),
      this.relations.of(myId),
    ]);

    // Keep only the newest message per chat partner (skipping people I blocked or requests I deleted)
    const lastByPartner = new Map<number, FullMessage>();
    for (const m of recent) {
      const partnerId = m.senderId === myId ? m.receiverId : m.senderId;
      if (!rel.hidden.has(partnerId) && !lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
    }

    const [partners, unread] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: [...lastByPartner.keys()] } }, select: PUBLIC_USER }),
      // How many messages each person sent me that I haven't opened yet
      this.prisma.message.groupBy({ by: ['senderId'], where: { receiverId: myId, readAt: null }, _count: { _all: true } }),
    ]);

    // Same order as lastByPartner: newest chat first
    return [...lastByPartner.entries()].flatMap(([partnerId, lastMessage]) => {
      const user = partners.find((p) => p.id === partnerId);
      const unreadCount = unread.find((u) => u.senderId === partnerId)?._count._all ?? 0;
      return user ? [{ user, lastMessage: this.toPublic(lastMessage), unreadCount, isRequest: rel.requests.has(partnerId) }] : [];
    });
  }

  async thread(myId: number, otherId: number) {
    await this.findPartner(myId, otherId);

    // Opening the chat = I've read everything they sent me. But NOT for a message request:
    // a stranger can't find out you read it until you accept.
    if (!(await this.relations.isRequestFor(myId, otherId))) {
      const { count } = await this.prisma.message.updateMany({
        where: { senderId: otherId, receiverId: myId, readAt: null },
        data: { readAt: new Date() },
      });
      if (count) {
        this.realtime.emitToUser(otherId, 'read', { by: myId }); // their "Sent" turns into "Seen" instantly
        await this.notifications.readChat(myId, otherId); // and the bell forgets these messages
      }
    }

    // Newest 200, then flip so the oldest is at the top of the chat
    const messages = await this.prisma.message.findMany({
      where: between(myId, otherId),
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: WITH_EXTRAS,
    });
    return messages.reverse().map((m) => this.toPublic(m));
  }

  async send(myId: number, otherId: number, content: string, file?: UploadedFileData, replyToId?: number) {
    const text = content.trim();
    if (!text && !file) throw new BadRequestException('Message cannot be empty!');
    const partner = await this.findPartner(myId, otherId);
    if (await this.relations.blockedEitherWay(myId, otherId)) {
      throw new ForbiddenException("You can't message this person.");
    }

    // A reply must point at a message in this same chat
    if (replyToId !== undefined) {
      const original = await this.prisma.message.findFirst({ where: { id: replyToId, ...between(myId, otherId) }, select: { id: true } });
      if (!original) throw new BadRequestException('The message you replied to no longer exists.');
    }

    const attachment = file
      ? await this.files.save(file, [...IMAGE_TYPES, ...VIDEO_TYPES, ...AUDIO_TYPES], 'Only photos, videos and voice messages can be sent.')
      : null;
    const sent = await this.prisma.message.create({
      data: {
        senderId: myId,
        receiverId: otherId,
        content: this.crypto.encryptText(text), // stored encrypted
        attachmentFile: attachment?.fileName,
        attachmentMime: attachment?.mime,
        attachmentSize: attachment?.size,
        replyToId,
      },
      include: WITH_EXTRAS,
    });

    const sentPublic = this.toPublic(sent);
    // Push it live to both people's open tabs (the sender may have the chat open elsewhere too)
    const isRequest = !partner.isBot && (await this.relations.isRequestFor(otherId, myId));
    this.realtime.emitToUser(otherId, 'message', { ...sentPublic, isRequest });
    this.realtime.emitToUser(myId, 'message', sentPublic);

    // Talking to a human: add it to their bell (not for message requests: those only show a counter)
    if (!partner.isBot) {
      if (!isRequest) {
        const me = await this.prisma.user.findUniqueOrThrow({ where: { id: myId }, select: { username: true, displayName: true } });
        await this.notifications.message(otherId, { id: myId, name: me.displayName || me.username }, this.preview(sent));
      }
      return { sent: sentPublic, reply: null };
    }

    // Talking to the AI: answer in the background, so the user's message shows at once and the reply
    // streams in live. One reply at a time per person (in order), even if they send several quickly.
    const previous = this.botQueue.get(myId) ?? Promise.resolve();
    const next = previous.then(() => this.replyAsBot(myId, otherId)).catch((e) => this.logger.error(`Sparky failed to reply: ${String(e)}`));
    this.botQueue.set(myId, next);
    void next.finally(() => this.botQueue.get(myId) === next && this.botQueue.delete(myId));
    return { sent: sentPublic, reply: null };
  }

  // Sparky reads the conversation (since the last "New conversation"), including recent photos, and
  // answers. While writing, it pushes the text so far as "ai:stream" events, then saves the full reply.
  private async replyAsBot(myId: number, botId: number) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: myId }, select: { username: true, displayName: true, aiMemoryFrom: true } });
    const recent = await this.prisma.message.findMany({
      where: { ...between(myId, botId), deletedAt: null, ...(me.aiMemoryFrom && { createdAt: { gt: me.aiMemoryFrom } }) },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    recent.reverse();

    // Let Sparky look at the 3 newest photos the user sent (older ones become a short note, to save cost)
    const photoIds = new Set(
      recent
        .filter((m) => m.senderId === myId && m.attachmentFile && this.ai.canSee(m.attachmentMime!, m.attachmentSize!))
        .slice(-3)
        .map((m) => m.id),
    );
    const history: ChatTurn[] = [];
    for (const m of recent) {
      const text = this.crypto.decryptText(m.content);
      if (photoIds.has(m.id)) {
        history.push({ fromUser: true, content: text, image: { mime: m.attachmentMime!, data: await this.files.read(m.attachmentFile!) } });
      } else {
        const note = m.attachmentMime ? `[sent a ${labelOf(m.attachmentMime).split(' ').slice(1).join(' ').toLowerCase()}]` : '';
        history.push({ fromUser: m.senderId === myId, content: [note, text].filter(Boolean).join(' ') });
      }
    }

    // Push the reply as it's being written (at most ~10 times a second)
    this.realtime.emitToUser(myId, 'ai:stream', { botId, text: '' });
    let lastPush = 0;
    const replyText = await this.ai.reply({ name: me.displayName || me.username, username: me.username }, history, (soFar) => {
      if (Date.now() - lastPush < 100) return;
      lastPush = Date.now();
      this.realtime.emitToUser(myId, 'ai:stream', { botId, text: soFar });
    });

    const reply = await this.prisma.message.create({
      data: { senderId: botId, receiverId: myId, content: this.crypto.encryptText(replyText), readAt: new Date() },
      include: WITH_EXTRAS,
    });
    this.realtime.emitToUser(myId, 'message', this.toPublic(reply));
    this.realtime.emitToUser(myId, 'ai:stream', { botId, done: true });
  }

  // "New conversation" with Sparky: it forgets everything before now, and says so in the chat
  async resetBotMemory(myId: number) {
    const bot = await this.prisma.user.findFirstOrThrow({ where: { isBot: true }, select: { id: true } });
    await this.prisma.user.update({ where: { id: myId }, data: { aiMemoryFrom: new Date() } });
    const note = await this.prisma.message.create({
      data: {
        senderId: bot.id,
        receiverId: myId,
        content: this.crypto.encryptText("🧹 Fresh start! I've forgotten our earlier conversation. What's up?"),
        readAt: new Date(),
      },
      include: WITH_EXTRAS,
    });
    const pub = this.toPublic(note);
    this.realtime.emitToUser(myId, 'message', pub);
    return pub;
  }

  // Sparky helping in a chat with a friend: summarize it, suggest replies, or translate one message.
  // Only the person who asked sees the answer; nothing is saved.
  async assist(myId: number, friendId: number, action: AssistAction, messageId?: number, language?: string) {
    const friend = await this.findPartner(myId, friendId);
    if (friend.isBot) throw new BadRequestException('Ask Sparky directly in its own chat.');
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: myId }, select: { username: true, displayName: true } });
    const myName = me.displayName || me.username;
    const friendName = friend.displayName || friend.username;

    if (action === 'translate') {
      const m = await this.prisma.message.findFirst({ where: { id: messageId, ...between(myId, friendId), deletedAt: null } });
      if (!m) throw new NotFoundException('Message not found.');
      const text = this.crypto.decryptText(m.content);
      if (!text) throw new BadRequestException('There is no text to translate in that message.');
      return this.ai.assist('translate', { me: myName, friend: friendName, lines: [] }, { text, language });
    }

    const recent = await this.prisma.message.findMany({
      where: { ...between(myId, friendId), deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    if (!recent.length) throw new BadRequestException('There are no messages to work with yet.');
    const lines = recent.reverse().map((m) => {
      const who = m.senderId === myId ? myName : friendName;
      const text = this.crypto.decryptText(m.content) || (m.attachmentMime ? labelOf(m.attachmentMime) : '');
      return `${who}: ${text}`;
    });
    return this.ai.assist(action, { me: myName, friend: friendName, lines });
  }

  // Edit the text of my own message, within 15 minutes
  async edit(myId: number, messageId: number, content: string) {
    const m = await this.ownMessage(myId, messageId);
    if (Date.now() - m.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new BadRequestException('Messages can only be edited for 15 minutes after sending.');
    }
    const text = content.trim();
    if (!text && !m.attachmentFile) throw new BadRequestException('Message cannot be empty! Unsend it instead.');
    await this.prisma.message.update({ where: { id: m.id }, data: { content: this.crypto.encryptText(text), editedAt: new Date() } });
    return this.emitUpdate(m.id);
  }

  // Unsend: the message becomes "This message was deleted" for both people, and its file is erased
  async unsend(myId: number, messageId: number) {
    const m = await this.ownMessage(myId, messageId);
    await this.files.remove(m.attachmentFile);
    await this.prisma.$transaction([
      this.prisma.reaction.deleteMany({ where: { messageId: m.id } }),
      this.prisma.message.update({
        where: { id: m.id },
        data: {
          deletedAt: new Date(),
          content: this.crypto.encryptText(''),
          attachmentFile: null,
          attachmentMime: null,
          attachmentSize: null,
        },
      }),
    ]);
    await this.notifications.retract(m.receiverId, myId); // don't leave the text sitting in their bell
    return this.emitUpdate(m.id);
  }

  // React with an emoji. Same emoji again = remove it; a different one replaces it.
  async react(myId: number, messageId: number, emoji: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!m || (m.senderId !== myId && m.receiverId !== myId)) throw new NotFoundException('Message not found.');
    if (m.deletedAt) throw new BadRequestException("You can't react to a deleted message.");
    const existing = await this.prisma.reaction.findUnique({ where: { messageId_userId: { messageId, userId: myId } } });
    const removing = existing?.emoji === emoji;
    if (removing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.reaction.upsert({
        where: { messageId_userId: { messageId, userId: myId } },
        update: { emoji },
        create: { messageId, userId: myId, emoji },
      });
    }

    // Tell the person who wrote the message (not when reacting to my own, or to Sparky's)
    const ownerId = m.senderId;
    const owner = ownerId === myId ? null : await this.prisma.user.findUnique({ where: { id: ownerId }, select: { isBot: true } });
    if (owner && !owner.isBot) {
      if (removing) {
        await this.notifications.removeReaction(ownerId, myId, messageId);
      } else {
        const me = await this.prisma.user.findUniqueOrThrow({ where: { id: myId }, select: { username: true, displayName: true } });
        const name = me.displayName || me.username;
        await this.notifications.reaction(ownerId, { id: myId, name }, messageId, emoji, this.preview(m));
        this.realtime.emitToUser(ownerId, 'reaction', { from: myId, name, emoji, messageId, preview: this.preview(m) });
      }
    }
    return this.emitUpdate(messageId);
  }

  async attachment(myId: number, messageId: number) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    // Same answer for "doesn't exist" and "not your chat", so ids can't be probed
    if (!message?.attachmentFile || (message.senderId !== myId && message.receiverId !== myId)) {
      throw new NotFoundException('File not found.');
    }
    return { data: await this.files.read(message.attachmentFile), mime: message.attachmentMime! };
  }

  private async ownMessage(myId: number, messageId: number) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!m || m.senderId !== myId) throw new NotFoundException('Message not found.');
    if (m.deletedAt) throw new BadRequestException('This message was already deleted.');
    return m;
  }

  private async findPartner(myId: number, otherId: number) {
    if (myId === otherId) throw new BadRequestException("You can't message yourself.");
    const partner = await this.prisma.user.findUnique({ where: { id: otherId }, select: PUBLIC_USER });
    if (!partner) throw new NotFoundException('User not found.');
    return partner;
  }
}
