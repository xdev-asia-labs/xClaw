import type { Db, Collection } from 'mongodb';

export interface LLMResponseDoc {
  requestId: string;
  modelProfileId: string;
  modelName: string;
  provider: string;
  messages: Array<{ role: string; content: string }>;
  response: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs: number;
  toolCalls?: Array<{ name: string; arguments: string; result?: string }>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export class ResponseRepository {
  private col: Collection<LLMResponseDoc>;

  constructor(db: Db) {
    this.col = db.collection<LLMResponseDoc>('llm_responses');
  }

  async save(doc: LLMResponseDoc): Promise<void> {
    await this.col.insertOne(doc);
  }

  async getByRequestId(requestId: string): Promise<LLMResponseDoc | null> {
    return this.col.findOne({ requestId });
  }

  async listByModel(modelProfileId: string, limit = 50): Promise<LLMResponseDoc[]> {
    return this.col.find({ modelProfileId }).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async getStats(modelProfileId: string, days = 7): Promise<{
    totalRequests: number;
    avgLatencyMs: number;
    totalTokens: number;
  }> {
    const since = new Date(Date.now() - days * 86400000);
    const pipeline = [
      { $match: { modelProfileId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          avgLatencyMs: { $avg: '$latencyMs' },
          totalTokens: { $sum: '$usage.totalTokens' },
        },
      },
    ];
    const result = await this.col.aggregate(pipeline).toArray();
    if (!result[0]) return { totalRequests: 0, avgLatencyMs: 0, totalTokens: 0 };
    return {
      totalRequests: result[0].totalRequests,
      avgLatencyMs: Math.round(result[0].avgLatencyMs),
      totalTokens: result[0].totalTokens,
    };
  }
}
