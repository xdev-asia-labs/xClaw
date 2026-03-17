import type { ModelService } from './model.service.js';

export interface OllamaModel {
  name: string;
  size: number;
  sizeHuman: string;
  modifiedAt: string;
  details: Record<string, unknown>;
  registered: boolean;
}

export class OllamaService {
  constructor(private baseUrl: string = 'http://localhost:11434') {}

  async listModels(timeoutMs: number = 10000): Promise<OllamaModel[]> {
    const resp = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!resp.ok) throw new Error(`Ollama unreachable: ${resp.status}`);
    const data = await resp.json() as { models: Array<Record<string, unknown>> };

    return (data.models ?? []).map(m => ({
      name: m.name as string,
      size: m.size as number,
      sizeHuman: this.formatSize(m.size as number),
      modifiedAt: m.modified_at as string,
      details: (m.details ?? {}) as Record<string, unknown>,
      registered: false,
    }));
  }

  async pullModel(name: string, onProgress?: (progress: { status: string; completed?: number; total?: number }) => void): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!resp.ok) throw new Error(`Pull failed: ${resp.status}`);
    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const progress = JSON.parse(line);
          onProgress?.(progress);
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async removeModel(name: string): Promise<boolean> {
    const resp = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return resp.ok;
  }

  async getModelInfo(name: string): Promise<Record<string, unknown>> {
    const resp = await fetch(`${this.baseUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error(`Model not found: ${name}`);
    return resp.json() as Promise<Record<string, unknown>>;
  }

  async embed(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
    const resp = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text, options: { num_ctx: 8192 } }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!resp.ok) throw new Error(`Embedding failed: ${resp.status}`);
    const data = await resp.json() as { embedding: number[] };
    return data.embedding;
  }

  private formatSize(bytes: number): string {
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  }
}
