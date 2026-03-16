import type { Pool } from 'pg';
import type { AuditEntry } from '../../types/index.js';

export class AuditRepository {
  constructor(private pool: Pool) {}

  async log(data: {
    entityType: string;
    entityId: string;
    action: AuditEntry['action'];
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    performedBy?: string;
    sessionId?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, old_values, new_values, performed_by, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.entityType,
        data.entityId,
        data.action,
        data.oldValues ? JSON.stringify(data.oldValues) : null,
        data.newValues ? JSON.stringify(data.newValues) : null,
        data.performedBy ?? 'system',
        data.sessionId ?? null,
      ],
    );
  }

  async list(entityType?: string, entityId?: string, limit = 50): Promise<AuditEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (entityType) {
      conditions.push(`entity_type = $${idx++}`);
      params.push(entityType);
    }
    if (entityId) {
      conditions.push(`entity_id = $${idx++}`);
      params.push(entityId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const { rows } = await this.pool.query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${idx}`,
      params,
    );

    return rows.map(r => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      oldValues: r.old_values,
      newValues: r.new_values,
      performedBy: r.performed_by,
      sessionId: r.session_id,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
