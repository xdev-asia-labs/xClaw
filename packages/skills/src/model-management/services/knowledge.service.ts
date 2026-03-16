import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { KnowledgeRepository } from '../repositories/mongo/knowledge.repo.js';
import type { RAGRepository } from '../repositories/pg/rag.repo.js';
import type { Embedder } from '../rag/embedder.js';
import type { KBCollection, KBDocument, KBChunk, DocumentSource, ChunkStrategy } from '../types/index.js';
import { chunkText } from '../rag/chunker.js';
import { parseDocument } from '../rag/document-parser.js';

export class KnowledgeService {
  constructor(
    private knowledgeRepo: KnowledgeRepository,
    private ragRepo: RAGRepository,
    private embedder: Embedder,
  ) {}

  async createCollection(data: {
    name: string;
    description?: string;
    chunkStrategy?: ChunkStrategy;
    maxTokens?: number;
    overlap?: number;
    tags?: string[];
  }): Promise<KBCollection> {
    const collectionId = randomUUID();
    const collection = await this.knowledgeRepo.createCollection({
      collectionId,
      name: data.name,
      description: data.description,
      documentCount: 0,
      chunkCount: 0,
      totalTokens: 0,
      totalSizeBytes: 0,
      embeddingModel: this.embedder.modelName,
      embeddingDimensions: this.embedder.embeddingDimensions,
      chunkConfig: {
        strategy: data.chunkStrategy ?? 'recursive',
        maxTokens: data.maxTokens ?? 512,
        overlap: data.overlap ?? 50,
      },
      tags: data.tags ?? [],
    });

    // Create RAG config in PG
    await this.ragRepo.upsertConfig({
      collectionId,
      chunkStrategy: data.chunkStrategy ?? 'recursive',
      chunkMaxTokens: data.maxTokens ?? 512,
      chunkOverlap: data.overlap ?? 50,
      embeddingModel: this.embedder.modelName,
      embeddingProvider: 'ollama',
      embeddingDimensions: this.embedder.embeddingDimensions,
      searchTopK: 5,
      scoreThreshold: 0.7,
      autoInject: true,
    });

    return collection;
  }

  async addDocument(collectionId: string, source: DocumentSource, input: string, name?: string): Promise<KBDocument> {
    const collection = await this.knowledgeRepo.getCollection(collectionId);
    if (!collection) throw new Error(`Collection not found: ${collectionId}`);

    const documentId = randomUUID();
    const parsed = await parseDocument(source, input);
    const contentHash = createHash('sha256').update(parsed.content).digest('hex');

    const doc: KBDocument = {
      documentId,
      collectionId,
      name: name ?? (source === 'file' ? input.split('/').pop()! : `doc-${documentId.slice(0, 8)}`),
      source,
      mimeType: parsed.mimeType,
      contentHash,
      sizeBytes: parsed.sizeBytes,
      status: 'processing',
      chunkCount: 0,
      createdAt: new Date().toISOString(),
    };

    await this.knowledgeRepo.addDocument(doc);

    // Process in background-like manner (but awaited for simplicity)
    try {
      const chunkResults = chunkText(
        parsed.content,
        collection.chunkConfig.strategy,
        collection.chunkConfig.maxTokens,
        collection.chunkConfig.overlap,
      );

      const texts = chunkResults.map(c => c.content);
      const embeddings = await this.embedder.embedBatch(texts);

      const chunks: KBChunk[] = chunkResults.map((c, i) => ({
        chunkId: randomUUID(),
        documentId,
        collectionId,
        content: c.content,
        index: c.index,
        tokenCount: c.tokenCount,
        embedding: embeddings[i],
        embeddingModel: this.embedder.modelName,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        createdAt: new Date().toISOString(),
      }));

      await this.knowledgeRepo.addChunks(chunks);
      await this.knowledgeRepo.updateDocumentStatus(documentId, 'ready', chunks.length);

      // Update collection stats
      const allDocs = await this.knowledgeRepo.listDocuments(collectionId);
      const readyDocs = allDocs.filter(d => d.status === 'ready');
      const totalChunks = readyDocs.reduce((sum, d) => sum + d.chunkCount, 0);
      const totalSize = readyDocs.reduce((sum, d) => sum + d.sizeBytes, 0);
      const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

      await this.knowledgeRepo.updateCollectionStats(collectionId, {
        documentCount: readyDocs.length,
        chunkCount: totalChunks,
        totalSizeBytes: totalSize,
        totalTokens,
      });

      doc.status = 'ready';
      doc.chunkCount = chunks.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.knowledgeRepo.updateDocumentStatus(documentId, 'error', undefined, msg);
      doc.status = 'error';
      doc.error = msg;
    }

    return doc;
  }

  async listCollections(): Promise<KBCollection[]> {
    return this.knowledgeRepo.listCollections();
  }

  async listDocuments(collectionId: string): Promise<KBDocument[]> {
    return this.knowledgeRepo.listDocuments(collectionId);
  }

  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    await this.knowledgeRepo.deleteDocument(documentId);
    // Recalculate stats
    const docs = await this.knowledgeRepo.listDocuments(collectionId);
    const readyDocs = docs.filter(d => d.status === 'ready');
    await this.knowledgeRepo.updateCollectionStats(collectionId, {
      documentCount: readyDocs.length,
      chunkCount: readyDocs.reduce((sum, d) => sum + d.chunkCount, 0),
    });
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await this.knowledgeRepo.deleteCollection(collectionId);
  }
}
