import type { Pool } from 'pg';
import type { UsageRecord } from '../../types/index.js';

export class UsageRepository {
  constructor(private pool: Pool) {}

  async record(data: {
    modelProfileId: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costEstimate?: number;
    requestType?: string;
    latencyMs?: number;
    sessionId?: string;
  }): Promise<UsageRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO usage_records
         (model_profile_id, prompt_tokens, completion_tokens, total_tokens,
          cost_estimate, request_type, latency_ms, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.modelProfileId,
        data.promptTokens,
        data.completionTokens,
        data.totalTokens,
        data.costEstimate ?? 0,
        data.requestType ?? 'chat',
        data.latencyMs ?? null,
        data.sessionId ?? null,
      ],
    );
    return this.mapRow(rows[0]);
  }

  async getSummary(modelProfileId: string, days = 30): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
  }> {
    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*)::int AS total_requests,
         COALESCE(SUM(total_tokens), 0)::int AS total_tokens,
         COALESCE(SUM(cost_estimate), 0)::numeric AS total_cost,
         COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms
       FROM usage_records
       WHERE model_profile_id = $1
         AND created_at >= NOW() - INTERVAL '1 day' * $2`,
      [modelProfileId, days],
    );
    const r = rows[0];
    return {
      totalRequests: r.total_requests,
      totalTokens: r.total_tokens,
      totalCost: Number(r.total_cost),
      avgLatencyMs: r.avg_latency_ms,
    };
  }

  async listRecent(modelProfileId: string, limit = 50): Promise<UsageRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM usage_records
       WHERE model_profile_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [modelProfileId, limit],
    );
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): UsageRecord {
    return {
      id: row.id as string,
      modelProfileId: row.model_profile_id as string,
      promptTokens: row.prompt_tokens as number,
      completionTokens: row.completion_tokens as number,
      totalTokens: row.total_tokens as number,
      costEstimate: Number(row.cost_estimate),
      requestType: row.request_type as UsageRecord['requestType'],
      latencyMs: row.latency_ms as number | undefined,
      sessionId: row.session_id as string | undefined,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
