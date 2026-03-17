// ============================================================
// Discord Channel Plugin - Using discord.js (same as OpenClaw)
// ============================================================

import { Client, GatewayIntentBits, type Message, Partials } from 'discord.js';
import type { ChannelPlugin, IncomingMessage, OutgoingMessage, ChatPlatform } from '@xclaw/shared';

export class DiscordChannel implements ChannelPlugin {
  readonly id = 'discord';
  readonly platform: ChatPlatform = 'discord';
  readonly name = 'Discord';
  readonly version = '0.1.0';
  readonly description = 'Discord bot integration via discord.js';

  private client?: Client;
  private token?: string;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.token = config.botToken as string;
    if (!this.token) {
      throw new Error('Discord botToken is required');
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });

    this.client.on('messageCreate', async (msg: Message) => {
      // Ignore bot messages
      if (msg.author.bot) return;
      if (!this.messageHandler) return;

      const incoming: IncomingMessage = {
        platform: 'discord',
        channelId: msg.channelId,
        userId: msg.author.id,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        replyTo: msg.reference?.messageId,
        metadata: {
          username: msg.author.username,
          displayName: msg.author.displayName,
          guildId: msg.guildId,
          guildName: msg.guild?.name,
        },
      };

      await this.messageHandler(incoming);
    });
  }

  async start(): Promise<void> {
    if (!this.client || !this.token) {
      throw new Error('Discord channel not initialized');
    }
    await this.client.login(this.token);
    console.log(`[Discord] Bot logged in as ${this.client.user?.tag}`);
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      console.log('[Discord] Bot disconnected');
    }
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (!this.client) throw new Error('Discord channel not initialized');

    const channel = await this.client.channels.fetch(message.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Discord channel not found or not text-based: ${message.channelId}`);
    }

    if ('send' in channel) {
      await channel.send({
        content: message.content,
        reply: message.replyTo ? { messageReference: message.replyTo } : undefined,
      });
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }
}

// Default export for plugin system
export default new DiscordChannel();
