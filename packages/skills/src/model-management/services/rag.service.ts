import type { VectorSearch } from '../rag/vector-search.js';
import type { RAGRepository } from '../repositories/pg/rag.repo.js';
import type { KnowledgeRepository } from '../repositories/mongo/knowledge.repo.js';
import type { RAGSearchResult } from '../types/index.js';

export class RAGService {
  constructor(
    private vectorSearch: VectorSearch,
    private ragRepo: RAGRepository,
    private knowledgeRepo: KnowledgeRepository,
  ) {}

  async search(query: string, collectionIds?: string[], topK?: number): Promise<RAGSearchResult[]> {
    // If no collection specified, search all with autoInject
    let targetCollections = collectionIds;
    if (!targetCollections || targetCollections.length === 0) {
      const allCollections = await this.knowledgeRepo.listCollections();
      targetCollections = allCollections.map(c => c.collectionId);
    }

    if (targetCollections.length === 0) return [];

    // Use first collection's config for defaults, or use defaults
    const config = await this.ragRepo.getConfig(targetCollections[0]);
    const effectiveTopK = topK ?? config?.searchTopK ?? 5;
    const threshold = config?.scoreThreshold ?? 0.7;

    const embedStart = Date.now();
    const results = await this.vectorSearch.search(query, targetCollections, effectiveTopK, threshold);
    const totalLatency = Date.now() - embedStart;

    // Log query
    await this.ragRepo.logQuery({
      queryText: query,
      queryEmbeddingModel: config?.embeddingModel,
      collectionIds: targetCollections,
      chunksRetrieved: results.length,
      topScore: results[0]?.score,
      avgScore: results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : undefined,
      searchLatencyMs: totalLatency,
    }).catch(() => {}); // Non-critical

    return results;
  }

  async buildContext(query: string, collectionIds?: string[], maxTokens: number = 2000): Promise<string> {
    const results = await this.search(query, collectionIds);
    if (results.length === 0) return '';

    let context = '';
    let tokens = 0;

    for (const result of results) {
      const chunkTokens = Math.ceil(result.content.length / 4);
      if (tokens + chunkTokens > maxTokens) break;
      context += `---\n[Source: ${result.documentId}, Score: ${result.score.toFixed(3)}]\n${result.content}\n\n`;
      tokens += chunkTokens;
    }

    return context.trim();
  }
}
