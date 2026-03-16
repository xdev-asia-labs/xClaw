import type { Pool } from 'pg';

export class SessionRepository {
  constructor(private pool: Pool) {}

  async setActiveModel(sessionId: string, modelProfileId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Close current session
      await client.query(
        `UPDATE model_sessions SET valid_to = NOW()
         WHERE session_id = $1 AND valid_to = 'infinity'`,
        [sessionId],
      );
      // Open new session
      await client.query(
        `INSERT INTO model_sessions (model_profile_id, session_id, valid_from, valid_to)
         VALUES ($1, $2, NOW(), 'infinity')`,
        [modelProfileId, sessionId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getActiveModel(sessionId: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      `SELECT model_profile_id FROM model_sessions
       WHERE session_id = $1 AND valid_to = 'infinity'
       LIMIT 1`,
      [sessionId],
    );
    return rows[0]?.model_profile_id ?? null;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE model_sessions SET valid_to = NOW()
       WHERE session_id = $1 AND valid_to = 'infinity'`,
      [sessionId],
    );
  }

  async getHistory(sessionId: string, limit = 20): Promise<Array<{ modelProfileId: string; validFrom: string; validTo: string }>> {
    const { rows } = await this.pool.query(
      `SELECT model_profile_id, valid_from, valid_to
       FROM model_sessions
       WHERE session_id = $1
       ORDER BY valid_from DESC
       LIMIT $2`,
      [sessionId, limit],
    );
    return rows.map(r => ({
      modelProfileId: r.model_profile_id,
      validFrom: r.valid_from,
      validTo: r.valid_to,
    }));
  }
}
