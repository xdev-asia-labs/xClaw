import type { BenchmarkRepository } from '../repositories/pg/benchmark.repo.js';
import type { OllamaService } from './ollama.service.js';
import type { BenchmarkResult } from '../types/index.js';
import os from 'node:os';

export class BenchmarkService {
  constructor(
    private benchmarkRepo: BenchmarkRepository,
    private ollamaService: OllamaService,
    private ollamaBaseUrl: string,
  ) {}

  async runBenchmark(modelProfileId: string, modelId: string, testType: string): Promise<BenchmarkResult> {
    const hardwareInfo = {
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model,
      totalMemory: `${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB`,
      freeMemory: `${(os.freemem() / (1024 ** 3)).toFixed(1)} GB`,
      platform: os.platform(),
    };

    const results: Record<string, unknown> = {};
    let tokensPerSecond: number | undefined;
    let firstTokenMs: number | undefined;
    let qualityScore: number | undefined;
    let toolCallingAccuracy: number | undefined;

    const prompts = this.getTestPrompts(testType);
    const startTime = Date.now();

    for (const prompt of prompts) {
      const result = await this.runSingleTest(modelId, prompt);
      Object.assign(results, { [prompt.name]: result });
      if (result.tokensPerSecond) tokensPerSecond = result.tokensPerSecond as number;
      if (result.firstTokenMs) firstTokenMs = result.firstTokenMs as number;
    }

    const durationMs = Date.now() - startTime;

    if (testType === 'speed' || testType === 'full') {
      qualityScore = this.calculateQualityScore(results);
    }

    return this.benchmarkRepo.create({
      modelProfileId,
      testType,
      results,
      tokensPerSecond,
      firstTokenMs,
      qualityScore,
      toolCallingAccuracy,
      durationMs,
      hardwareInfo,
    });
  }

  async getHistory(modelProfileId: string): Promise<BenchmarkResult[]> {
    return this.benchmarkRepo.listByModel(modelProfileId);
  }

  private getTestPrompts(testType: string): Array<{ name: string; prompt: string; expectedFormat?: string }> {
    const speedPrompt = { name: 'speed', prompt: 'Write a short paragraph about TypeScript benefits.' };
    const codePrompt = { name: 'code', prompt: 'Write a TypeScript function that sorts an array of objects by a given key.' };
    const toolPrompt = { name: 'tool_calling', prompt: 'Use the calculator tool to compute 42 * 17.' };
    const vietnamesePrompt = { name: 'vietnamese', prompt: 'Giải thích về lập trình hướng đối tượng bằng tiếng Việt.' };

    switch (testType) {
      case 'speed': return [speedPrompt];
      case 'code': return [codePrompt];
      case 'tool_calling': return [toolPrompt];
      case 'vietnamese': return [vietnamesePrompt];
      case 'full': return [speedPrompt, codePrompt, toolPrompt, vietnamesePrompt];
      default: return [speedPrompt];
    }
  }

  private async runSingleTest(modelId: string, test: { name: string; prompt: string }): Promise<Record<string, unknown>> {
    const start = Date.now();
    let firstTokenAt: number | undefined;
    let totalTokens = 0;
    let responseText = '';

    const resp = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt: test.prompt,
        stream: true,
      }),
    });

    if (!resp.ok) throw new Error(`Benchmark request failed: ${resp.status}`);
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
          const parsed = JSON.parse(line);
          if (!firstTokenAt && parsed.response) firstTokenAt = Date.now();
          if (parsed.response) {
            responseText += parsed.response;
            totalTokens++;
          }
        } catch { /* skip */ }
      }
    }

    const durationMs = Date.now() - start;
    const firstTokenMs = firstTokenAt ? firstTokenAt - start : undefined;
    const tokensPerSecond = durationMs > 0 ? (totalTokens / durationMs) * 1000 : 0;

    return {
      testName: test.name,
      durationMs,
      firstTokenMs,
      totalTokens,
      tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
      responseLength: responseText.length,
    };
  }

  private calculateQualityScore(results: Record<string, unknown>): number {
    let score = 5.0;
    for (const val of Object.values(results)) {
      const r = val as Record<string, unknown>;
      const tps = r.tokensPerSecond as number | undefined;
      if (tps && tps > 20) score += 1;
      if (tps && tps > 40) score += 1;
      const ftm = r.firstTokenMs as number | undefined;
      if (ftm && ftm < 500) score += 0.5;
    }
    return Math.min(10, Math.round(score * 10) / 10);
  }
}
