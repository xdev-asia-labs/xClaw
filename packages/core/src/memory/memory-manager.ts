// ============================================================
// Memory Manager - Persistent memory with vector search
// ============================================================

import type { MemoryEntry, ConversationMessage } from '@xclaw/shared';
import { LLMRouter, type LLMAdapter } from '../llm/llm-router.js';

export interface MemoryStore {
  save(entry: MemoryEntry): Promise<void>;
  get(id: string): Promise<MemoryEntry | null>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  searchByEmbedding(embedding: number[], limit?: number): Promise<MemoryEntry[]>;
  delete(id: string): Promise<void>;
  listByTags(tags: string[], limit?: number): Promise<MemoryEntry[]>;
  listByType(type: MemoryEntry['type'], limit?: number): Promise<MemoryEntry[]>;
}

// ─── In-Memory Store (dev / small-scale) ────────────────────

export class InMemoryStore implements MemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();

  async save(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry, updatedAt: new Date().toISOString() });
  }

  async get(id: string): Promise<MemoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async search(query: string, limit = 10): Promise<MemoryEntry[]> {
    const lower = query.toLowerCase();
    return [...this.entries.values()]
      .filter(e => e.content.toLowerCase().includes(lower))
      .slice(0, limit);
  }

  async searchByEmbedding(embedding: number[], limit = 10): Promise<MemoryEntry[]> {
    // Cosine similarity search
    const scored = [...this.entries.values()]
      .filter(e => e.embedding?.length)
      .map(e => ({
        entry: e,
        score: this.cosineSim(embedding, e.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(s => s.entry);
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async listByTags(tags: string[], limit = 20): Promise<MemoryEntry[]> {
    return [...this.entries.values()]
      .filter(e => tags.some(t => e.tags.includes(t)))
      .slice(0, limit);
  }

  async listByType(type: MemoryEntry['type'], limit = 20): Promise<MemoryEntry[]> {
    return [...this.entries.values()]
      .filter(e => e.type === type)
      .slice(0, limit);
  }

  private cosineSim(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

// ─── Memory Manager ─────────────────────────────────────────

export class MemoryManager {
  private conversations: Map<string, ConversationMessage[]> = new Map();

  constructor(
    private store: MemoryStore,
    private embedAdapter?: LLMAdapter,
  ) {}

  // Save a fact/preference to long-term memory
  async remember(content: string, type: MemoryEntry['type'], tags: string[] = [], source = 'user'): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      type,
      content,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source,
      tags,
    };

    // Generate embedding if adapter available
    if (this.embedAdapter?.embed) {
      entry.embedding = await this.embedAdapter.embed(content);
    }

    await this.store.save(entry);
    return entry;
  }

  // Semantic search over memories (falls back to text search if embedding fails)
  async recall(query: string, limit = 5): Promise<MemoryEntry[]> {
    if (this.embedAdapter?.embed) {
      try {
        const embedding = await this.embedAdapter.embed(query);
        return this.store.searchByEmbedding(embedding, limit);
      } catch {
        // Fall back to text search when embedding is unavailable
      }
    }
    return this.store.search(query, limit);
  }

  async forget(id: string): Promise<void> {
    await this.store.delete(id);
  }

  // ─── Conversation History ───────────────────────────────

  addMessage(sessionId: string, message: ConversationMessage): void {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    this.conversations.get(sessionId)!.push(message);
  }

  getHistory(sessionId: string, limit?: number): ConversationMessage[] {
    const history = this.conversations.get(sessionId) ?? [];
    return limit ? history.slice(-limit) : history;
  }

  clearSession(sessionId: string): void {
    this.conversations.delete(sessionId);
  }
}
