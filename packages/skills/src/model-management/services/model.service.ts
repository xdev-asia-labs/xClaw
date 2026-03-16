import type { ModelProfile, CreateModelInput, UpdateModelInput, LLMProvider } from '../types/index.js';
import type { ModelRepository } from '../repositories/pg/model.repo.js';
import { encrypt, decrypt, type EncryptedData } from '../crypto/key-encryption.js';

export class ModelService {
  constructor(
    private repo: ModelRepository,
    private encryptionKey: string,
  ) {}

  async listModels(filters?: { provider?: string; status?: string }): Promise<ModelProfile[]> {
    return this.repo.list(filters);
  }

  async getById(id: string): Promise<ModelProfile | null> {
    return this.repo.getById(id);
  }

  async createModel(input: CreateModelInput): Promise<ModelProfile> {
    let encryptedApiKey: Buffer | undefined;
    let encryptionIv: Buffer | undefined;
    let encryptionTag: Buffer | undefined;

    if (input.apiKey) {
      const enc = encrypt(input.apiKey, this.encryptionKey);
      encryptedApiKey = enc.encrypted;
      encryptionIv = enc.iv;
      encryptionTag = enc.tag;
    }

    const profile = await this.repo.create({
      name: input.name,
      provider: input.provider,
      modelId: input.modelId,
      baseUrl: input.baseUrl,
      encryptedApiKey,
      encryptionIv,
      encryptionTag,
      temperature: input.parameters?.temperature,
      maxTokens: input.parameters?.maxTokens,
      topP: input.parameters?.topP,
      supportsToolCalling: input.capabilities?.toolCalling,
      supportsVision: input.capabilities?.vision,
      supportsEmbedding: input.capabilities?.embedding,
      isDefault: input.isDefault,
    });

    return profile;
  }

  async updateModel(input: UpdateModelInput): Promise<ModelProfile | null> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
    if (input.parameters?.temperature !== undefined) data.temperature = input.parameters.temperature;
    if (input.parameters?.maxTokens !== undefined) data.maxTokens = input.parameters.maxTokens;
    if (input.parameters?.topP !== undefined) data.topP = input.parameters.topP;
    if (input.capabilities?.toolCalling !== undefined) data.supportsToolCalling = input.capabilities.toolCalling;
    if (input.capabilities?.vision !== undefined) data.supportsVision = input.capabilities.vision;
    if (input.capabilities?.embedding !== undefined) data.supportsEmbedding = input.capabilities.embedding;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.notes !== undefined) data.notes = input.notes;

    return this.repo.update(input.id, data);
  }

  async softDeleteModel(id: string): Promise<{ id: string; deleted: boolean }> {
    const deleted = await this.repo.softDelete(id);
    return { id, deleted };
  }

  async switchModel(modelId: string, scope: string = 'default'): Promise<{ previousModel?: ModelProfile; activeModel: ModelProfile }> {
    const previous = await this.getActiveModel(scope);
    await this.repo.setDefault(modelId);
    const active = await this.repo.getById(modelId);
    if (!active) throw new Error(`Model not found: ${modelId}`);
    return { previousModel: previous?.model ?? undefined, activeModel: active };
  }

  async getActiveModel(scope: string = 'default'): Promise<{ model: ModelProfile; scope: string; since: string } | null> {
    const model = await this.repo.getDefault();
    if (!model) return null;
    return { model, scope, since: model.createdAt };
  }

  async testConnection(modelId: string): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
    const model = await this.repo.getById(modelId);
    if (!model) return { reachable: false, latencyMs: 0, error: 'Model not found' };

    const baseUrl = model.baseUrl || (model.provider === 'ollama' ? 'http://localhost:11434' : undefined);
    if (!baseUrl) return { reachable: false, latencyMs: 0, error: 'No base URL configured' };

    const start = Date.now();
    try {
      const url = model.provider === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      return { reachable: resp.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { reachable: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
