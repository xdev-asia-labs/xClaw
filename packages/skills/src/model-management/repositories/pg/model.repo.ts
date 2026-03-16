import type { PgPool } from './connection.js';
import type { ModelProfile, CreateModelInput, LLMProvider, ModelStatus } from '../../types/index.js';

export class ModelRepository {
  constructor(private pool: PgPool) {}

  async list(filters?: { provider?: string; status?: string }): Promise<ModelProfile[]> {
    const conditions = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filters?.provider) {
      params.push(filters.provider);
      conditions.push(`provider = $${params.length}`);
    }
    if (filters?.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    const sql = `SELECT * FROM model_profiles WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const { rows } = await this.pool.query(sql, params);
    return rows.map(this.mapRow);
  }

  async getById(id: string): Promise<ModelProfile | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM model_profiles WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(data: {
    name: string; provider: LLMProvider; modelId: string; baseUrl?: string;
    encryptedApiKey?: Buffer; encryptionIv?: Buffer; encryptionTag?: Buffer;
    temperature?: number; maxTokens?: number; topP?: number;
    supportsToolCalling?: boolean; supportsVision?: boolean; supportsEmbedding?: boolean;
    isDefault?: boolean; tags?: string[]; notes?: string;
  }): Promise<ModelProfile> {
    const { rows } = await this.pool.query(`
      INSERT INTO model_profiles (
        name, provider, model_id, base_url,
        encrypted_api_key, encryption_iv, encryption_tag,
        temperature, max_tokens, top_p,
        supports_tool_calling, supports_vision, supports_embedding,
        is_default, tags, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      data.name, data.provider, data.modelId, data.baseUrl ?? null,
      data.encryptedApiKey ?? null, data.encryptionIv ?? null, data.encryptionTag ?? null,
      data.temperature ?? 0.7, data.maxTokens ?? 4096, data.topP ?? 1.0,
      data.supportsToolCalling ?? false, data.supportsVision ?? false, data.supportsEmbedding ?? false,
      data.isDefault ?? false, data.tags ?? [], data.notes ?? null,
    ]);
    return this.mapRow(rows[0]);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ModelProfile | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const columnMap: Record<string, string> = {
      name: 'name', baseUrl: 'base_url', temperature: 'temperature',
      maxTokens: 'max_tokens', topP: 'top_p', tags: 'tags', notes: 'notes',
      status: 'status', isDefault: 'is_default',
      supportsToolCalling: 'supports_tool_calling',
      supportsVision: 'supports_vision', supportsEmbedding: 'supports_embedding',
    };

    for (const [key, value] of Object.entries(data)) {
      const col = columnMap[key];
      if (col && value !== undefined) {
        fields.push(`${col} = $${idx}`);
        params.push(value);
        idx++;
      }
    }

    if (fields.length === 0) return this.getById(id);
    params.push(id);
    const sql = `UPDATE model_profiles SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`;
    const { rows } = await this.pool.query(sql, params);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'UPDATE model_profiles SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND is_default = false', [id]
    );
    return (rowCount ?? 0) > 0;
  }

  async getDefault(): Promise<ModelProfile | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM model_profiles WHERE is_default = true AND deleted_at IS NULL LIMIT 1'
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async setDefault(id: string): Promise<void> {
    await this.pool.query('BEGIN');
    try {
      await this.pool.query('UPDATE model_profiles SET is_default = false WHERE is_default = true AND deleted_at IS NULL');
      await this.pool.query('UPDATE model_profiles SET is_default = true WHERE id = $1 AND deleted_at IS NULL', [id]);
      await this.pool.query('COMMIT');
    } catch (err) {
      await this.pool.query('ROLLBACK');
      throw err;
    }
  }

  private mapRow(row: Record<string, unknown>): ModelProfile {
    return {
      id: row.id as string,
      name: row.name as string,
      provider: row.provider as LLMProvider,
      modelId: row.model_id as string,
      baseUrl: row.base_url as string | undefined,
      hasApiKey: row.encrypted_api_key != null,
      temperature: Number(row.temperature),
      maxTokens: row.max_tokens as number,
      topP: Number(row.top_p),
      supportsToolCalling: row.supports_tool_calling as boolean,
      supportsVision: row.supports_vision as boolean,
      supportsEmbedding: row.supports_embedding as boolean,
      status: row.status as ModelStatus,
      isDefault: row.is_default as boolean,
      tags: row.tags as string[],
      notes: row.notes as string | undefined,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}
