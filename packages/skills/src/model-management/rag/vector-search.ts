import type { Collection } from 'mongodb';
import type { KBChunk, RAGSearchResult } from '../types/index.js';
import type { Embedder } from './embedder.js';

export class VectorSearch {
  constructor(
    private chunksCollection: Collection<KBChunk>,
    private embedder: Embedder,
  ) {}

  async search(
    query: string,
    collectionIds: string[],
    topK: number = 5,
    scoreThreshold: number = 0.7,
  ): Promise<RAGSearchResult[]> {
    const queryEmbedding = await this.embedder.embed(query);

    // Use cosine similarity via MongoDB aggregation
    // Since MongoDB Atlas has $vectorSearch, for self-hosted we compute manually
    const chunks = await this.chunksCollection
      .find({
        collectionId: { $in: collectionIds },
        embedding: { $exists: true },
      })
      .toArray();

    const scored = chunks
      .map(chunk => ({
        content: chunk.content,
        documentId: chunk.documentId,
        collectionId: chunk.collectionId,
        chunkIndex: chunk.index,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter(r => r.score >= scoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
