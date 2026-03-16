import type { ModelService } from '../services/model.service.js';

export function createModelCrudTools(modelService: ModelService) {
  return {
    model_list: async (args: Record<string, unknown>) => {
      const models = await modelService.listModels({
        provider: args.provider as string | undefined,
        status: args.status as string | undefined,
      });
      return { models, count: models.length };
    },

    model_create: async (args: Record<string, unknown>) => {
      const model = await modelService.createModel({
        name: args.name as string,
        provider: args.provider as 'ollama' | 'openai' | 'anthropic' | 'google' | 'custom',
        modelId: args.modelId as string,
        apiKey: args.apiKey as string | undefined,
        baseUrl: args.baseUrl as string | undefined,
        parameters: {
          temperature: args.temperature as number | undefined,
          maxTokens: args.maxTokens as number | undefined,
        },
      });
      return model;
    },

    model_update: async (args: Record<string, unknown>) => {
      const model = await modelService.updateModel({
        id: args.id as string,
        name: args.name as string | undefined,
        baseUrl: args.baseUrl as string | undefined,
        parameters: {
          temperature: args.temperature as number | undefined,
          maxTokens: args.maxTokens as number | undefined,
        },
        tags: args.tags as string[] | undefined,
        notes: args.notes as string | undefined,
      });
      return model ?? { error: 'Model not found' };
    },

    model_delete: async (args: Record<string, unknown>) => {
      return modelService.softDeleteModel(args.id as string);
    },
  };
}
