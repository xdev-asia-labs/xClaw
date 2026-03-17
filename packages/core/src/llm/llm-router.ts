// ============================================================
// LLM Router - Abstract layer to call any LLM provider
// ============================================================

import type { LLMConfig, LLMMessage, LLMResponse, ToolDefinition, ToolCall } from '@xclaw/shared';

export interface LLMAdapter {
  chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  chatStream?(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<{ type: 'delta' | 'done'; content: string; toolCalls?: ToolCall[]; finishReason?: string }>;
  embed?(text: string): Promise<number[]>;
}

// ─── OpenAI Adapter ─────────────────────────────────────────

export class OpenAIAdapter implements LLMAdapter {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(m => this.formatMessage(m)),
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 4096,
    };

    if (tools?.length) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              t.parameters.map(p => [p.name, {
                type: p.type,
                description: p.description,
                enum: p.enum,
              }])
            ),
            required: t.parameters.filter(p => p.required).map(p => p.name),
          },
        },
      }));
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return this.parseResponse(data);
  }

  async *chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<{ type: 'delta' | 'done'; content: string; toolCalls?: ToolCall[]; finishReason?: string }> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map(m => this.formatMessage(m)),
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 4096,
      stream: true,
    };

    if (tools?.length) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              t.parameters.map(p => [p.name, {
                type: p.type,
                description: p.description,
                enum: p.enum,
              }])
            ),
            required: t.parameters.filter(p => p.required).map(p => p.name),
          },
        },
      }));
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API error ${res.status}: ${errText}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCallAccum: Map<number, { id: string; name: string; args: string }> = new Map();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          // Yield accumulated tool calls if any
          if (toolCallAccum.size > 0) {
            const tcs: ToolCall[] = [...toolCallAccum.values()].map(tc => ({
              id: tc.id,
              name: tc.name,
              arguments: JSON.parse(tc.args || '{}'),
            }));
            yield { type: 'done', content: '', toolCalls: tcs, finishReason: 'tool_calls' };
          } else {
            yield { type: 'done', content: '', finishReason: 'stop' };
          }
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Accumulate tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallAccum.has(idx)) {
                toolCallAccum.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' });
              }
              const acc = toolCallAccum.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }

          // Yield text delta
          if (delta.content) {
            yield { type: 'delta', content: delta.content };
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.config.apiKey) throw new Error('No API key configured for embeddings');
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });
    if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
    const data = await res.json() as { data: { embedding: number[] }[] };
    if (!data.data?.[0]?.embedding) throw new Error('Invalid embedding response');
    return data.data[0].embedding;
  }

  private formatMessage(msg: LLMMessage): Record<string, unknown> {
    const formatted: Record<string, unknown> = { role: msg.role, content: msg.content };
    if (msg.toolCallId) formatted.tool_call_id = msg.toolCallId;
    if (msg.toolCalls) {
      formatted.tool_calls = msg.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
    }
    return formatted;
  }

  private parseResponse(data: Record<string, unknown>): LLMResponse {
    const choices = data.choices as { message: Record<string, unknown>; finish_reason: string }[];
    const choice = choices[0];
    const message = choice.message;
    const usage = data.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number };

    const toolCalls = (message.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined)?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    return {
      content: (message.content as string) ?? '',
      toolCalls,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      model: data.model as string,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    };
  }
}

// ─── Anthropic Adapter ──────────────────────────────────────

export class AnthropicAdapter implements LLMAdapter {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 4096,
      messages: chatMessages.map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
    };

    if (systemMsg) body.system = systemMsg.content;

    if (tools?.length) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: {
          type: 'object',
          properties: Object.fromEntries(
            t.parameters.map(p => [p.name, {
              type: p.type,
              description: p.description,
            }])
          ),
          required: t.parameters.filter(p => p.required).map(p => p.name),
        },
      }));
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return this.parseResponse(data);
  }

  private parseResponse(data: Record<string, unknown>): LLMResponse {
    const content = data.content as { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
    const textParts = content.filter(c => c.type === 'text').map(c => c.text).join('');
    const toolParts = content.filter(c => c.type === 'tool_use');
    const usage = data.usage as { input_tokens: number; output_tokens: number };

    return {
      content: textParts,
      toolCalls: toolParts.length > 0 ? toolParts.map(tc => ({
        id: tc.id!,
        name: tc.name!,
        arguments: tc.input ?? {},
      })) : undefined,
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
      },
      model: data.model as string,
      finishReason: (data.stop_reason as string) === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }
}

// ─── LLM Router ─────────────────────────────────────────────

export class LLMRouter {
  private adapters: Map<string, LLMAdapter> = new Map();

  registerAdapter(name: string, adapter: LLMAdapter): void {
    this.adapters.set(name, adapter);
  }

  getAdapter(name: string): LLMAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) throw new Error(`LLM adapter not found: ${name}`);
    return adapter;
  }

  static createFromConfig(config: LLMConfig): LLMAdapter {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config);
      case 'anthropic':
        return new AnthropicAdapter(config);
      case 'ollama':
        return new OpenAIAdapter({ ...config, baseUrl: config.baseUrl ?? 'http://localhost:11434/v1' });
      default:
        return new OpenAIAdapter(config);
    }
  }
}
