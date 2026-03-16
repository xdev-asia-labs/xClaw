import type { Db, Collection } from 'mongodb';

export interface MemoryEntryDoc {
  key: string;
  category: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class MemoryRepository {
  private col: Collection<MemoryEntryDoc>;

  constructor(db: Db) {
    this.col = db.collection<MemoryEntryDoc>('memory_entries');
  }

  async upsert(key: string, category: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.col.updateOne(
      { key },
      {
        $set: { category, content, metadata, updatedAt: new Date() },
        $setOnInsert: { key, createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  async get(key: string): Promise<MemoryEntryDoc | null> {
    return this.col.findOne({ key });
  }

  async listByCategory(category: string, limit = 50): Promise<MemoryEntryDoc[]> {
    return this.col.find({ category }).sort({ updatedAt: -1 }).limit(limit).toArray();
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.col.deleteOne({ key });
    return result.deletedCount > 0;
  }

  async search(query: string, category?: string, limit = 10): Promise<MemoryEntryDoc[]> {
    const filter: Record<string, unknown> = {
      $text: { $search: query },
    };
    if (category) filter.category = category;

    return this.col.find(filter).sort({ score: { $meta: 'textScore' } }).limit(limit).toArray();
  }
}
