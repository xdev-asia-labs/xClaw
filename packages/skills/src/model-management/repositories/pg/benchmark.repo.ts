import type { Pool } from 'pg';
import type { BenchmarkResult } from '../../types/index.js';

export class BenchmarkRepository {
  constructor(private pool: Pool) {}

  async create(data: {
    modelProfileId: string;
    testType: string;
    results: Record<string, unknown>;
    tokensPerSecond?: number;
    firstTokenMs?: number;
    qualityScore?: number;
    toolCallingAccuracy?: number;
    durationMs?: number;
    hardwareInfo?: Record<string, unknown>;
  }): Promise<BenchmarkResult> {
    const { rows } = await this.pool.query(
      `INSERT INTO benchmark_results
         (model_profile_id, test_type, results, tokens_per_second, first_token_ms,
          quality_score, tool_calling_accuracy, duration_ms, hardware_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.modelProfileId,
        data.testType,
        JSON.stringify(data.results),
        data.tokensPerSecond ?? null,
        data.firstTokenMs ?? null,
        data.qualityScore ?? null,
        data.toolCallingAccuracy ?? null,
        data.durationMs ?? null,
        data.hardwareInfo ? JSON.stringify(data.hardwareInfo) : null,
      ],
    );
    return this.mapRow(rows[0]);
  }

  async listByModel(modelProfileId: string, limit = 20): Promise<BenchmarkResult[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM benchmark_results
       WHERE model_profile_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [modelProfileId, limit],
    );
    return rows.map(r => this.mapRow(r));
  }

  async getLatest(modelProfileId: string, testType?: string): Promise<BenchmarkResult | null> {
    const params: unknown[] = [modelProfileId];
    let sql = `SELECT * FROM benchmark_results WHERE model_profile_id = $1`;
    if (testType) {
      sql += ` AND test_type = $2`;
      params.push(testType);
    }
    sql += ` ORDER BY created_at DESC LIMIT 1`;

    const { rows } = await this.pool.query(sql, params);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  private mapRow(row: Record<string, unknown>): BenchmarkResult {
    return {
      id: row.id as string,
      modelProfileId: row.model_profile_id as string,
      testType: row.test_type as BenchmarkResult['testType'],
      results: row.results as Record<string, unknown>,
      tokensPerSecond: row.tokens_per_second ? Number(row.tokens_per_second) : undefined,
      firstTokenMs: row.first_token_ms as number | undefined,
      qualityScore: row.quality_score ? Number(row.quality_score) : undefined,
      toolCallingAccuracy: row.tool_calling_accuracy ? Number(row.tool_calling_accuracy) : undefined,
      durationMs: row.duration_ms as number | undefined,
      hardwareInfo: row.hardware_info as Record<string, unknown> | undefined,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
