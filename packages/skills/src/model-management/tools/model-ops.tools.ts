import type { ModelService } from '../services/model.service.js';
import type { BenchmarkService } from '../services/benchmark.service.js';

export function createModelOpsTools(modelService: ModelService, benchmarkService: BenchmarkService) {
  return {
    model_switch: async (args: Record<string, unknown>) => {
      const scope = (args.scope as string) || 'default';
      const result = await modelService.switchModel(args.modelId as string, scope);
      return { ...result, scope };
    },

    model_get_active: async () => {
      const result = await modelService.getActiveModel();
      if (!result) return { error: 'No active model configured' };
      return result;
    },

    model_benchmark: async (args: Record<string, unknown>) => {
      const modelId = args.model_id as string ?? args.modelId as string;
      const testType = (args.test_type as string) ?? 'full';
      if (!modelId) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: model_id' }], isError: true };
      }
      const result = await benchmarkService.runBenchmark(modelId, modelId, testType);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },

    model_test_connection: async (args: Record<string, unknown>) => {
      return modelService.testConnection(args.modelId as string);
    },
  };
}
