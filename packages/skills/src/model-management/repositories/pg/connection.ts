import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

export type PgPool = pg.Pool;

export function createPgPool(connectionString: string): PgPool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });
}

export async function runMigrations(pool: PgPool, migrationsDir: string): Promise<void> {
  // Wait for PG to be truly ready (retry with backoff)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      if (attempt === 5) throw err;
      console.log(`[migration] PG not ready, retry ${attempt}/5...`);
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }

  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const executed = await pool.query('SELECT filename FROM _migrations ORDER BY filename');
  const executedSet = new Set(executed.rows.map((r: { filename: string }) => r.filename));

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (executedSet.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`[migration] Executed: ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
}
