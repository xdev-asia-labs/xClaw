import type { Db, Collection } from 'mongodb';
import type { KBCollection, KBDocument, KBChunk } from '../../types/index.js';

export class KnowledgeRepository {
  private collections: Collection<KBCollection>;
  private documents: Collection<KBDocument>;
  private chunks: Collection<KBChunk>;

  constructor(db: Db) {
    this.collections = db.collection<KBCollection>('knowledge_collections');
    this.documents = db.collection<KBDocument>('knowledge_documents');
    this.chunks = db.collection<KBChunk>('knowledge_chunks');
  }

  // ── Collections ─────────────────────────────────────────
  async createCollection(data: Omit<KBCollection, 'createdAt' | 'updatedAt'>): Promise<KBCollection> {
    const doc: KBCollection = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this.collections.insertOne(doc);
    return doc;
  }

  async getCollection(collectionId: string): Promise<KBCollection | null> {
    return this.collections.findOne({ collectionId });
  }

  async listCollections(): Promise<KBCollection[]> {
    return this.collections.find().sort({ updatedAt: -1 }).toArray();
  }

  async updateCollectionStats(collectionId: string, stats: { documentCount?: number; chunkCount?: number; totalTokens?: number; totalSizeBytes?: number }): Promise<void> {
    const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (stats.documentCount !== undefined) $set.documentCount = stats.documentCount;
    if (stats.chunkCount !== undefined) $set.chunkCount = stats.chunkCount;
    if (stats.totalTokens !== undefined) $set.totalTokens = stats.totalTokens;
    if (stats.totalSizeBytes !== undefined) $set.totalSizeBytes = stats.totalSizeBytes;
    await this.collections.updateOne({ collectionId }, { $set });
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await Promise.all([
      this.chunks.deleteMany({ collectionId }),
      this.documents.deleteMany({ collectionId }),
      this.collections.deleteOne({ collectionId }),
    ]);
  }

  // ── Documents ───────────────────────────────────────────
  async addDocument(doc: KBDocument): Promise<void> {
    await this.documents.insertOne(doc);
  }

  async getDocument(documentId: string): Promise<KBDocument | null> {
    return this.documents.findOne({ documentId });
  }

  async listDocuments(collectionId: string): Promise<KBDocument[]> {
    return this.documents.find({ collectionId }).sort({ createdAt: -1 }).toArray();
  }

  async updateDocumentStatus(documentId: string, status: KBDocument['status'], chunkCount?: number, error?: string): Promise<void> {
    const $set: Record<string, unknown> = { status };
    if (chunkCount !== undefined) $set.chunkCount = chunkCount;
    if (error !== undefined) $set.error = error;
    await this.documents.updateOne({ documentId }, { $set });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.chunks.deleteMany({ documentId });
    await this.documents.deleteOne({ documentId });
  }

  // ── Chunks ──────────────────────────────────────────────
  async addChunks(chunks: KBChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    await this.chunks.insertMany(chunks);
  }

  async getChunks(documentId: string): Promise<KBChunk[]> {
    return this.chunks.find({ documentId }).sort({ index: 1 }).toArray();
  }

  async getChunksByCollection(collectionId: string): Promise<KBChunk[]> {
    return this.chunks.find({ collectionId }).toArray();
  }

  getChunksCollection(): Collection<KBChunk> {
    return this.chunks;
  }
}
