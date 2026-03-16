import type { Pool } from 'pg';
import type { Db } from 'mongodb';
import type { OllamaService } from './ollama.service.js';

export interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  postgres: { status: string; latencyMs: number };
  mongodb: { status: string; latencyMs: number };
  ollama: { status: string; latencyMs: number; modelCount?: number };
  timestamp: string;
}

export class HealthService {
  constructor(
    private pgPool: Pool,
    private mongoDB: Db,
    private ollamaService: OllamaService,
  ) {}

  async check(): Promise<HealthReport> {
    const [pg, mongo, ollama] = await Promise.all([
      this.checkPostgres(),
      this.checkMongo(),
      this.checkOllama(),
    ]);

    const statuses = [pg.status, mongo.status, ollama.status];
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (statuses.includes('unhealthy')) overall = 'degraded';
    if (statuses.every(s => s === 'unhealthy')) overall = 'unhealthy';

    return { overall, postgres: pg, mongodb: mongo, ollama, timestamp: new Date().toISOString() };
  }

  private async checkPostgres(): Promise<{ status: string; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.pgPool.query('SELECT 1');
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch {
      return { status: 'unhealthy', latencyMs: Date.now() - start };
    }
  }

  private async checkMongo(): Promise<{ status: string; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.mongoDB.command({ ping: 1 });
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch {
      return { status: 'unhealthy', latencyMs: Date.now() - start };
    }
  }

  private async checkOllama(): Promise<{ status: string; latencyMs: number; modelCount?: number }> {
    const start = Date.now();
    try {
      const models = await this.ollamaService.listModels();
      return { status: 'healthy', latencyMs: Date.now() - start, modelCount: models.length };
    } catch {
      return { status: 'unhealthy', latencyMs: Date.now() - start };
    }
  }
}
