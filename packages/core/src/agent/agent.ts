// ============================================================
// Agent Core - The brain that ties everything together
// ============================================================

import type {
  AgentConfig, LLMMessage, IncomingMessage, OutgoingMessage,
  ConversationMessage, ToolCall, Workflow,
} from '@xclaw/shared';
import { EventBus } from './event-bus.js';
import { LLMRouter, type LLMAdapter } from '../llm/llm-router.js';
import { MemoryManager, InMemoryStore } from '../memory/memory-manager.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { SkillManager } from '../skills/skill-manager.js';
import { WorkflowEngine } from '../workflow/workflow-engine.js';

const MAX_TOOL_ITERATIONS = 10;

export class Agent {
  readonly eventBus: EventBus;
  readonly llmRouter: LLMRouter;
  readonly memory: MemoryManager;
  readonly tools: ToolRegistry;
  readonly skills: SkillManager;
  readonly workflows: WorkflowEngine;

  private config: AgentConfig;
  private llmAdapter: LLMAdapter;
  private ragContextProvider?: (query: string) => Promise<string>;
  private ragDetailedProvider?: (query: string) => Promise<{ context: string; chunks: { content: string; documentId: string; collectionId: string; score: number }[] }>;
  private _lastRAGChunks?: { content: string; documentId: string; collectionId: string; score: number }[];

  constructor(config: AgentConfig) {
    this.config = config;
    this.eventBus = new EventBus();

    // Init LLM
    this.llmRouter = new LLMRouter();
    this.llmAdapter = LLMRouter.createFromConfig(config.llm);
    this.llmRouter.registerAdapter('default', this.llmAdapter);

    // Init Memory
    const store = new InMemoryStore();
    const embedAdapter = this.llmAdapter.embed ? this.llmAdapter : undefined;
    this.memory = new MemoryManager(store, embedAdapter);

    // Init Tools
    this.tools = new ToolRegistry(this.eventBus);

    // Init Skills
    this.skills = new SkillManager(this.tools, this.eventBus);

    // Init Workflow Engine
    this.workflows = new WorkflowEngine(this.tools, this.llmRouter, this.eventBus);

    // Register built-in tools
    this.registerBuiltinTools();
  }

  // ─── Main Chat Loop ─────────────────────────────────────

  async chat(sessionId: string, userMessage: string): Promise<string> {
    // Save user message to history
    this.memory.addMessage(sessionId, {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Build message array for LLM
    const messages = await this.buildMessages(sessionId, userMessage);

    // Get relevant tools (filtered to avoid overwhelming smaller models)
    const toolDefs = this.tools.getRelevantDefinitions(userMessage);

    // Agent loop with tool calling
    let iterations = 0;
    let response = await this.llmAdapter.chat(messages, toolDefs);

    while (response.finishReason === 'tool_calls' && response.toolCalls && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Execute all tool calls
      const results = await this.tools.executeAll(response.toolCalls);

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      // Add tool results
      let directContent = '';
      for (const result of results) {
        const resultStr = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
        if (resultStr.includes('```xclaw-chart')) {
          directContent += '\n\n' + resultStr + '\n\n';
          messages.push({
            role: 'tool',
            content: 'Chart has been rendered to the user successfully.',
            toolCallId: result.toolCallId,
          });
        } else {
          messages.push({
            role: 'tool',
            content: JSON.stringify(result.result),
            toolCallId: result.toolCallId,
          });
        }
      }

      // Continue conversation
      response = await this.llmAdapter.chat(messages, toolDefs);
      if (directContent) {
        response.content = directContent + (response.content || '');
      }
    }

    const assistantContent = response.content || '(No response)';

    // Save assistant message to history
    this.memory.addMessage(sessionId, {
      id: crypto.randomUUID(),
      sessionId,
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
    });

    await this.eventBus.emit({
      type: 'agent:response',
      payload: { sessionId, content: assistantContent, usage: response.usage },
      source: 'agent',
      timestamp: new Date().toISOString(),
    });

    return assistantContent;
  }

  // ─── Streaming Chat ───────────────────────────────────────

  async *chatStream(sessionId: string, userMessage: string): AsyncGenerator<{ type: 'delta' | 'tool' | 'done' | 'rag_context'; content: string }> {
    // Save user message to history
    this.memory.addMessage(sessionId, {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    const messages = await this.buildMessages(sessionId, userMessage);
    const toolDefs = this.tools.getRelevantDefinitions(userMessage);

    // Emit RAG context if available
    if (this._lastRAGChunks && this._lastRAGChunks.length > 0) {
      yield { type: 'rag_context', content: JSON.stringify(this._lastRAGChunks) };
      this._lastRAGChunks = undefined;
    }

    // Check if adapter supports streaming
    if (!this.llmAdapter.chatStream) {
      // Fallback to non-streaming
      const response = await this.llmAdapter.chat(messages, toolDefs);
      yield { type: 'delta', content: response.content || '(No response)' };
      yield { type: 'done', content: '' };
      return;
    }

    let fullContent = '';
    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      let iterContent = '';

      for await (const chunk of this.llmAdapter.chatStream(messages, toolDefs)) {
        if (chunk.type === 'delta') {
          iterContent += chunk.content;
          yield { type: 'delta', content: chunk.content };
        } else if (chunk.type === 'done') {
          if (chunk.finishReason === 'tool_calls' && chunk.toolCalls?.length) {
            // Execute tool calls
            yield { type: 'tool', content: `Calling tools: ${chunk.toolCalls.map(tc => tc.name).join(', ')}` };
            const results = await this.tools.executeAll(chunk.toolCalls);

            messages.push({
              role: 'assistant',
              content: iterContent,
              toolCalls: chunk.toolCalls,
            });

            for (const result of results) {
              const resultStr = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
              // If the tool result contains renderable content (chart, PDF link), emit it directly to the client
              if (resultStr.includes('```xclaw-chart')) {
                yield { type: 'delta', content: '\n\n' + resultStr + '\n\n' };
                fullContent += '\n\n' + resultStr + '\n\n';
                messages.push({
                  role: 'tool',
                  content: 'Chart has been rendered to the user successfully.',
                  toolCallId: result.toolCallId,
                });
              } else {
                messages.push({
                  role: 'tool',
                  content: JSON.stringify(result.result),
                  toolCallId: result.toolCallId,
                });
              }
            }
            // Continue the loop for the next LLM call
            iterContent = '';
            break;
          } else {
            // Done - no more tool calls
            fullContent += iterContent;
            yield { type: 'done', content: '' };

            // Save to memory
            this.memory.addMessage(sessionId, {
              id: crypto.randomUUID(),
              sessionId,
              role: 'assistant',
              content: fullContent || '(No response)',
              timestamp: new Date().toISOString(),
            });

            await this.eventBus.emit({
              type: 'agent:response',
              payload: { sessionId, content: fullContent },
              source: 'agent',
              timestamp: new Date().toISOString(),
            });

            return;
          }
        }
      }
    }

    // If we exhausted iterations, still finalize
    yield { type: 'done', content: '' };
    if (fullContent) {
      this.memory.addMessage(sessionId, {
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ─── Handle incoming from messaging platforms ───────────

  async handleMessage(incoming: IncomingMessage): Promise<OutgoingMessage> {
    const sessionId = `${incoming.platform}:${incoming.channelId}:${incoming.userId}`;
    const response = await this.chat(sessionId, incoming.content);

    return {
      platform: incoming.platform,
      channelId: incoming.channelId,
      content: response,
      replyTo: incoming.replyTo,
    };
  }

  // ─── Execute a workflow ─────────────────────────────────

  async runWorkflow(workflow: Workflow, triggerData?: Record<string, unknown>) {
    return this.workflows.execute(workflow, triggerData);
  }

  // ─── RAG Integration ─────────────────────────────────────

  setRAGContextProvider(provider: (query: string) => Promise<string>): void {
    this.ragContextProvider = provider;
  }

  setRAGDetailedProvider(provider: (query: string) => Promise<{ context: string; chunks: { content: string; documentId: string; collectionId: string; score: number }[] }>): void {
    this.ragDetailedProvider = provider;
  }

  // ─── Internal ───────────────────────────────────────────

  private async buildMessages(sessionId: string, currentMessage: string): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // System prompt with persona and context
    const systemParts = [
      this.config.systemPrompt || `You are ${this.config.name}, a helpful AI assistant.`,
      this.config.persona ? `\nPersona: ${this.config.persona}` : '',
    ];

    // Inject relevant memories
    if (this.config.memory.enabled) {
      const memories = await this.memory.recall(currentMessage, 5);
      if (memories.length > 0) {
        systemParts.push('\n\n## Relevant Memories:\n' +
          memories.map(m => `- [${m.type}] ${m.content}`).join('\n'));
      }
    }

    // Inject RAG context if provider is set
    if (this.ragDetailedProvider) {
      try {
        const result = await this.ragDetailedProvider(currentMessage);
        if (result.context) {
          systemParts.push('\n\n## Knowledge Base Context:\n' + result.context);
          this._lastRAGChunks = result.chunks;
        }
      } catch { /* non-critical */ }
    } else if (this.ragContextProvider) {
      try {
        const ragContext = await this.ragContextProvider(currentMessage);
        if (ragContext) {
          systemParts.push('\n\n## Knowledge Base Context:\n' + ragContext);
        }
      } catch { /* non-critical */ }
    }

    messages.push({ role: 'system', content: systemParts.join('') });

    // Add conversation history
    const history = this.memory.getHistory(sessionId, 20);
    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        toolCalls: msg.toolCalls,
      });
    }

    return messages;
  }

  private registerBuiltinTools(): void {
    // Memory tools - let the LLM save/search memories
    this.tools.register(
      {
        name: 'memory_save',
        description: 'Save a fact, preference, or important information to long-term memory',
        category: 'memory',
        parameters: [
          { name: 'content', type: 'string', description: 'The information to remember', required: true },
          { name: 'type', type: 'string', description: 'Type: fact, preference, context, skill-data', required: true, enum: ['fact', 'preference', 'context', 'skill-data'] },
          { name: 'tags', type: 'array', description: 'Tags for categorization', required: false },
        ],
        returns: { name: 'entry', type: 'object', description: 'The saved memory entry' },
      },
      async (args) => {
        const entry = await this.memory.remember(
          args.content as string,
          args.type as 'fact' | 'preference' | 'context' | 'skill-data',
          args.tags as string[] ?? [],
        );
        return { id: entry.id, saved: true };
      },
    );

    this.tools.register(
      {
        name: 'memory_search',
        description: 'Search long-term memory for relevant information',
        category: 'memory',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
          { name: 'limit', type: 'number', description: 'Max results', required: false },
        ],
        returns: { name: 'results', type: 'array', description: 'Matching memory entries' },
      },
      async (args) => {
        const results = await this.memory.recall(args.query as string, args.limit as number ?? 5);
        return results.map(r => ({ id: r.id, type: r.type, content: r.content, tags: r.tags }));
      },
    );

    // Workflow trigger tool
    this.tools.register(
      {
        name: 'workflow_list',
        description: 'List all available workflows',
        category: 'workflow',
        parameters: [],
        returns: { name: 'workflows', type: 'array', description: 'Available workflows' },
      },
      async () => {
        return { note: 'Workflow listing from store - override in server' };
      },
    );
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  updateConfig(partial: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...partial };
    if (partial.llm) {
      this.llmAdapter = LLMRouter.createFromConfig(this.config.llm);
      this.llmRouter.registerAdapter('default', this.llmAdapter);
    }
  }
}
