// ============================================================
// EventBus - Internal pub/sub for decoupled communication
// ============================================================

import type { AgentEvent, EventHandler } from '@xclaw/shared';

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();

  on(eventType: string, handler: EventHandler): () => void {
    if (eventType === '*') {
      this.wildcardHandlers.add(handler);
      return () => this.wildcardHandlers.delete(handler);
    }
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  async emit(event: AgentEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? new Set();
    const all = [...handlers, ...this.wildcardHandlers];
    await Promise.allSettled(all.map(h => h(event)));
  }

  removeAll(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}
