// ============================================================
// Channel Manager - Registers and routes to channel plugins
// ============================================================

import type { ChannelPlugin, IncomingMessage, OutgoingMessage, ChatPlatform } from '@xclaw/shared';

export class ChannelManager {
  private channels: Map<string, ChannelPlugin> = new Map();
  private messageHandler?: (message: IncomingMessage) => Promise<void>;

  /** Register a channel plugin */
  async register(channel: ChannelPlugin, config: Record<string, unknown> = {}): Promise<void> {
    await channel.initialize(config);
    channel.onMessage(async (msg) => {
      if (this.messageHandler) {
        await this.messageHandler(msg);
      }
    });
    this.channels.set(channel.id, channel);
  }

  /** Start all registered channels */
  async startAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.start();
    }
  }

  /** Stop all registered channels */
  async stopAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.stop();
    }
  }

  /** Send a message through the appropriate channel */
  async send(message: OutgoingMessage): Promise<void> {
    const channel = this.getByPlatform(message.platform);
    if (!channel) {
      throw new Error(`No channel registered for platform: ${message.platform}`);
    }
    await channel.send(message);
  }

  /** Set the handler for incoming messages from all channels */
  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  getByPlatform(platform: ChatPlatform): ChannelPlugin | undefined {
    return [...this.channels.values()].find(c => c.platform === platform);
  }

  get(id: string): ChannelPlugin | undefined {
    return this.channels.get(id);
  }

  getAll(): ChannelPlugin[] {
    return [...this.channels.values()];
  }

  async unregister(id: string): Promise<void> {
    const channel = this.channels.get(id);
    if (channel) {
      await channel.stop();
      this.channels.delete(id);
    }
  }
}
