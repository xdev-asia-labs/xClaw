import type { Pool } from 'pg';
import type { RAGConfig } from '../../types/index.js';

export class RAGRepository {
  constructor(private pool: Pool) {}

  async getConfig(collectionId: string): Promise<RAGConfig | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM rag_configs WHERE collection_id = $1`,
      [collectionId],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async upsertConfig(data: Omit<RAGConfig, 'id'>): Promise<RAGConfig> {
    const { rows } = await this.pool.query(
      `INSERT INTO rag_configs
         (collection_id, chunk_strategy, chunk_max_tokens, chunk_overlap,
          embedding_model, embedding_provider, embedding_dimensions,
          search_top_k, score_threshold, auto_inject)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (collection_id) DO UPDATE SET
         chunk_strategy = EXCLUDED.chunk_strategy,
         chunk_max_tokens = EXCLUDED.chunk_max_tokens,
         chunk_overlap = EXCLUDED.chunk_overlap,
         embedding_model = EXCLUDED.embedding_model,
         embedding_provider = EXCLUDED.embedding_provider,
         embedding_dimensions = EXCLUDED.embedding_dimensions,
         search_top_k = EXCLUDED.search_top_k,
         score_threshold = EXCLUDED.score_threshold,
         auto_inject = EXCLUDED.auto_inject,
         updated_at = NOW()
       RETURNING *`,
      [
        data.collectionId, data.chunkStrategy, data.chunkMaxTokens, data.chunkOverlap,
        data.embeddingModel, data.embeddingProvider, data.embeddingDimensions,
        data.searchTopK, data.scoreThreshold, data.autoInject,
      ],
    );
    return this.mapRow(rows[0]);
  }

  async logQuery(data: {
    queryText: string;
    queryEmbeddingModel?: string;
    collectionIds: string[];
    chunksRetrieved: number;
    topScore?: number;
    avgScore?: number;
    searchLatencyMs?: number;
    embedLatencyMs?: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO rag_query_log
         (query_text, query_embedding_model, collection_ids, chunks_retrieved,
          top_score, avg_score, search_latency_ms, embed_latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.queryText, data.queryEmbeddingModel ?? null,
        data.collectionIds, data.chunksRetrieved,
        data.topScore ?? null, data.avgScore ?? null,
        data.searchLatencyMs ?? null, data.embedLatencyMs ?? null,
      ],
    );
  }

  private mapRow(row: Record<string, unknown>): RAGConfig {
    return {
      id: row.id as string,
      collectionId: row.collection_id as string,
      chunkStrategy: row.chunk_strategy as RAGConfig['chunkStrategy'],
      chunkMaxTokens: row.chunk_max_tokens as number,
      chunkOverlap: row.chunk_overlap as number,
      embeddingModel: row.embedding_model as string,
      embeddingProvider: row.embedding_provider as RAGConfig['embeddingProvider'],
      embeddingDimensions: row.embedding_dimensions as number,
      searchTopK: row.search_top_k as number,
      scoreThreshold: Number(row.score_threshold),
      autoInject: row.auto_inject as boolean,
    };
  }
}
