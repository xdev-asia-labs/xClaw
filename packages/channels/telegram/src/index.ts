// ============================================================
// Telegram Channel Plugin - Using grammY (same as OpenClaw)
// ============================================================

import { Bot, type Context } from 'grammy';
import type { ChannelPlugin, IncomingMessage, OutgoingMessage, ChatPlatform } from '@xclaw/shared';

export class TelegramChannel implements ChannelPlugin {
  readonly id = 'telegram';
  readonly platform: ChatPlatform = 'telegram';
  readonly name = 'Telegram';
  readonly version = '0.1.0';
  readonly description = 'Telegram bot integration via grammY';

  private bot?: Bot;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const token = config.botToken as string;
    if (!token) {
      throw new Error('Telegram botToken is required');
    }
    this.bot = new Bot(token);

    this.bot.on('message:text', async (ctx: Context) => {
      if (!this.messageHandler || !ctx.message?.text || !ctx.from) return;

      const incoming: IncomingMessage = {
        platform: 'telegram',
        channelId: String(ctx.chat?.id ?? ''),
        userId: String(ctx.from.id),
        content: ctx.message.text,
        timestamp: new Date().toISOString(),
        replyTo: ctx.message.reply_to_message
          ? String(ctx.message.reply_to_message.message_id)
          : undefined,
        metadata: {
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          chatType: ctx.chat?.type,
        },
      };

      await this.messageHandler(incoming);
    });
  }

  async start(): Promise<void> {
    if (!this.bot) throw new Error('Telegram channel not initialized');
    // Start polling (non-blocking)
    this.bot.start({ onStart: () => console.log('[Telegram] Bot started polling') });
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      console.log('[Telegram] Bot stopped');
    }
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (!this.bot) throw new Error('Telegram channel not initialized');
    const chatId = parseInt(message.channelId);
    if (isNaN(chatId)) throw new Error('Invalid Telegram chat ID');

    await this.bot.api.sendMessage(chatId, message.content, {
      reply_parameters: message.replyTo ? { message_id: parseInt(message.replyTo) } : undefined,
    });
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }
}

// Default export for plugin system
export default new TelegramChannel();
