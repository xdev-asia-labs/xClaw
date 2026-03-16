import type { OllamaService } from '../services/ollama.service.js';

export class Embedder {
  constructor(
    private ollamaService: OllamaService,
    private model: string = 'nomic-embed-text',
    private dimensions: number = 768,
  ) {}

  async embed(text: string): Promise<number[]> {
    return this.ollamaService.embed(text, this.model);
  }

  async embedBatch(texts: string[], batchSize = 5): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await Promise.all(batch.map(t => this.embed(t)));
      results.push(...embeddings);
    }
    return results;
  }

  get modelName(): string { return this.model; }
  get embeddingDimensions(): number { return this.dimensions; }
}
