import type { OllamaService } from '../services/ollama.service.js';
import type { ModelService } from '../services/model.service.js';

export function createOllamaTools(ollamaService: OllamaService, modelService: ModelService) {
  return {
    ollama_list: async (_args: Record<string, unknown>) => {
      const [ollamaModels, registeredModels] = await Promise.all([
        ollamaService.listModels(),
        modelService.listModels({ provider: 'ollama' }),
      ]);

      const registeredNames = new Set(registeredModels.map(m => m.name));
      const enriched = ollamaModels.map(m => ({
        ...m,
        registered: registeredNames.has(m.name),
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ total: enriched.length, models: enriched }, null, 2) }],
      };
    },

    ollama_pull: async (args: Record<string, unknown>) => {
      const name = args.name as string;
      if (!name) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required parameter: name' }], isError: true };
      }

      const progressLog: string[] = [];
      await ollamaService.pullModel(name, (p) => {
        if (p.status) progressLog.push(p.status);
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, model: name, message: `Model ${name} pulled successfully` }, null, 2) }],
      };
    },

    ollama_remove: async (args: Record<string, unknown>) => {
      const name = args.name as string;
      if (!name) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required parameter: name' }], isError: true };
      }

      const ok = await ollamaService.removeModel(name);
      if (!ok) {
        return { content: [{ type: 'text' as const, text: `❌ Failed to remove model ${name}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, model: name, message: `Model ${name} removed from Ollama` }, null, 2) }],
      };
    },
  };
}
