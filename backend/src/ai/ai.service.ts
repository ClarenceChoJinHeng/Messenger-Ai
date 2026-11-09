import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { simpleReply } from './simple-bot.js';

// The AI's account. "ai" is shorter than 3 letters, so no real person can register it.
export const BOT_USERNAME = 'ai';

const MODEL = 'claude-opus-5-5';

// Who Sparky is. This part never changes (the person's name and the date are added after it).
const SPARKY_PROMPT = `You are Sparky, a friendly AI assistant inside a chat app called Messenger AI.
You are chatting one-on-one with a user, like a friend in a messenger.
Keep replies short and conversational: usually 1 to 4 sentences, longer only when the user asks for detail.
Write plain text only. No markdown headings, tables or bold, because replies show in a simple chat bubble. Emojis are fine.
You can see photos the user sends. You can't listen to voice messages or watch videos: if they send one, say so kindly and ask them to type it.`;

// Image types Claude can look at, and its size limit per image
const VISION_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type VisionType = (typeof VISION_TYPES)[number];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ChatTurn {
  fromUser: boolean; // true = the human wrote it, false = Sparky wrote it
  content: string;
  image?: { mime: string; data: Buffer }; // a photo the user sent (Sparky can look at it)
}

export interface ChatUser {
  name: string; // display name or username
  username: string;
}

// Helpers for friend chats
export type AssistAction = 'summarize' | 'suggest' | 'translate';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  // Claude is used only when ANTHROPIC_API_KEY is in .env. Otherwise Sparky runs on simple built-in commands.
  private readonly claude = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

  constructor(private readonly prisma: PrismaService) {}

  get usesClaude() {
    return !!this.claude;
  }

  // When the app starts: make sure the AI's user account exists
  async onModuleInit() {
    await this.prisma.user.upsert({
      where: { username: BOT_USERNAME },
      update: { isBot: true },
      create: {
        username: BOT_USERNAME,
        email: 'sparky@ai.local',
        password: await bcrypt.hash(randomUUID(), 10), // random, and bots can't log in anyway
        displayName: 'Sparky (AI)',
        bio: 'Your AI assistant. Ask me anything!',
        isBot: true,
      },
    });
    this.logger.log(this.claude ? 'Sparky is using Claude' : 'Sparky is in simple mode (no ANTHROPIC_API_KEY)');
  }

  // ---- chatting with Sparky (streamed: onText gets the reply so far, again and again) ----

  async reply(user: ChatUser, history: ChatTurn[], onText: (soFar: string) => void): Promise<string> {
    const last = history.at(-1)?.content ?? '';
    if (!this.claude) return simpleReply(last);

    // Claude's conversation must start with the user, so drop any leading Sparky messages
    const firstUser = history.findIndex((t) => t.fromUser);
    const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(firstUser).map((t) => ({
      role: t.fromUser ? 'user' : 'assistant',
      content: t.image
        ? [
            { type: 'image', source: { type: 'base64', media_type: t.image.mime as VisionType, data: t.image.data.toString('base64') } },
            { type: 'text', text: t.content || '(sent a photo)' },
          ]
        : t.content || '…',
    }));

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    try {
      const stream = this.claude.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: 'low' }, // quick chat replies don't need deep thinking
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default', // if Claude declines, the API retries on a fallback model by itself
        system: [
          { type: 'text', text: SPARKY_PROMPT },
          { type: 'text', text: `You are talking with ${user.name} (@${user.username}). Today is ${today}.` },
        ],
        messages,
      });

      let text = '';
      for await (const event of stream) {
        // A backup model took over after a decline: its answer starts fresh
        if (event.type === 'content_block_start' && event.content_block.type === 'fallback') text = '';
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          text += event.delta.text;
          onText(text);
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') return "Sorry, I can't help with that one. Try asking me something else!";
      return text.trim() || "Hmm, I'm not sure what to say to that.";
    } catch (error) {
      this.logError(error);
      // Keep the chat working: answer with the simple bot instead
      return `(My AI brain is offline right now, so here's my simple mode.) ${simpleReply(last)}`;
    }
  }

  // Which photos to show Claude: only real image types under its size limit
  canSee(mime: string, size: number) {
    return VISION_TYPES.includes(mime as VisionType) && size <= MAX_IMAGE_BYTES;
  }

  // ---- helping in chats with friends (only the person who asked sees the answer) ----

  async assist(action: AssistAction, chat: { me: string; friend: string; lines: string[] }, extra: { text?: string; language?: string } = {}) {
    if (!this.claude) {
      throw new ServiceUnavailableException("Sparky's AI isn't switched on yet: it needs an ANTHROPIC_API_KEY in the backend's .env.");
    }
    const transcript = chat.lines.join('\n');
    const prompts: Record<AssistAction, string> = {
      summarize: `Summarize this chat between ${chat.me} (me) and ${chat.friend} in 2 to 5 short bullet points starting with "• ". Plain text, no headings. Mention any plans, questions waiting for an answer, or decisions.\n\n<chat>\n${transcript}\n</chat>`,
      suggest: `Suggest 3 short, natural replies that ${chat.me} could send next to ${chat.friend}, matching the tone of the chat. Reply with exactly 3 lines, one reply per line, nothing else (no numbers, no quotes).\n\n<chat>\n${transcript}\n</chat>`,
      translate: `Translate this message into ${extra.language ?? 'English'}. Reply with only the translation.\n\n<message>\n${extra.text ?? ''}\n</message>`,
    };

    try {
      const response = await this.claude.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content: prompts[action] }],
      });
      if (response.stop_reason === 'refusal') throw new ServiceUnavailableException("Sparky can't help with this one.");
      // After a decline + backup model, only the text after the last fallback block counts
      const lastFallback = response.content.map((b) => b.type).lastIndexOf('fallback');
      const text = response.content
        .slice(lastFallback + 1)
        .flatMap((b) => (b.type === 'text' ? [b.text] : []))
        .join('')
        .trim();
      if (action === 'suggest') {
        return { suggestions: text.split('\n').map((l) => l.replace(/^[-•\d.)\s"]+|"$/g, '').trim()).filter(Boolean).slice(0, 3) };
      }
      return { text };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logError(error);
      throw new ServiceUnavailableException("Sparky couldn't reach its AI brain. Try again in a moment.");
    }
  }

  // Typed SDK errors first, so the log says what actually went wrong
  private logError(error: unknown) {
    if (error instanceof Anthropic.AuthenticationError) this.logger.error('ANTHROPIC_API_KEY was rejected. Check the key in .env');
    else if (error instanceof Anthropic.RateLimitError) this.logger.warn('Claude rate limit hit');
    else if (error instanceof Anthropic.APIError) this.logger.error(`Claude API error ${error.status}: ${error.message}`);
    else this.logger.error(`Could not reach Claude: ${String(error)}`);
  }
}
