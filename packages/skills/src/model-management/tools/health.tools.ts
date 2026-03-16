import type { HealthService } from '../services/health.service.js';

export function createHealthTools(healthService: HealthService) {
  return {
    provider_health_check: async (_args: Record<string, unknown>) => {
      const report = await healthService.check();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }],
      };
    },
  };
}
