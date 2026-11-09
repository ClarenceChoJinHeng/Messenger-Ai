import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { simpleReply } from './simple-bot.js';

// The AI's account. "ai" is shorter than 3 letters, so no real person can register it.
export const BOT_USERNAME = 'ai';

const SYSTEM_PROMPT = `You are Sparky, a friendly AI assistant inside a chat app called Messenger AI.
You are chatting one-on-one with a user, like a friend in a messenger.
Keep replies short and conversational: usually 1 to 4 sentences, longer only when the user asks for detail.
Write plain text only. No markdown headings, tables or bold, because replies show in a simple chat bubble.`;

export interface ChatTurn {
  fromUser: boolean; // true = the human wrote it, false = Sparky wrote it
  content: string;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  // Claude is used only when ANTHROPIC_API_KEY is in .env. Otherwise Sparky runs on simple built-in commands.
  private readonly claude = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

  constructor(private readonly prisma: PrismaService) {}

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

  async reply(history: ChatTurn[]): Promise<string> {
    const last = history.at(-1)?.content ?? '';
    if (!this.claude) return simpleReply(last);

    // Claude's conversation must start with the user, so drop any leading Sparky messages
    const firstUser = history.findIndex((t) => t.fromUser);
    const messages: Anthropic.MessageParam[] = history.slice(firstUser).map((t) => ({
      role: t.fromUser ? 'user' : 'assistant',
      content: t.content,
    }));

    try {
      const response = await this.claude.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        output_config: { effort: 'low' }, // quick chat replies don't need deep thinking
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default', // if Claude declines, the API retries on a fallback model by itself
        system: SYSTEM_PROMPT,
        messages,
      });

      if (response.stop_reason === 'refusal') {
        return "Sorry, I can't help with that one. Try asking me something else!";
      }

      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
        .trim();
      return text || "Hmm, I'm not sure what to say to that.";
    } catch (error) {
      // Typed SDK errors first, so the log says what actually went wrong
      if (error instanceof Anthropic.AuthenticationError) {
        this.logger.error('ANTHROPIC_API_KEY was rejected. Check the key in .env');
      } else if (error instanceof Anthropic.RateLimitError) {
        this.logger.warn('Claude rate limit hit');
      } else if (error instanceof Anthropic.APIError) {
        this.logger.error(`Claude API error ${error.status}: ${error.message}`);
      } else {
        this.logger.error(`Could not reach Claude: ${String(error)}`);
      }
      // Keep the chat working: answer with the simple bot instead
      return `(My AI brain is offline right now, so here's my simple mode.) ${simpleReply(last)}`;
    }
  }
}
