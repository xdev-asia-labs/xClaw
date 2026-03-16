import type { UsageRepository } from '../repositories/pg/usage.repo.js';

export class UsageService {
  constructor(private usageRepo: UsageRepository) {}

  async recordUsage(data: {
    modelProfileId: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costEstimate?: number;
    requestType?: string;
    latencyMs?: number;
    sessionId?: string;
  }) {
    return this.usageRepo.record(data);
  }

  async getSummary(modelProfileId: string, days = 30) {
    return this.usageRepo.getSummary(modelProfileId, days);
  }

  async getRecentUsage(modelProfileId: string, limit = 50) {
    return this.usageRepo.listRecent(modelProfileId, limit);
  }
}
