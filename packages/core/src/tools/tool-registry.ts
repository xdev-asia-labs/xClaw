// ============================================================
// Tool Registry & Executor - Sandbox for running tools safely
// ============================================================

import type { ToolDefinition, ToolCall, ToolResult } from '@xclaw/shared';
import { EventBus } from '../agent/event-bus.js';

export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private approvalCallback?: (tool: ToolDefinition, args: Record<string, unknown>) => Promise<boolean>;

  constructor(private eventBus: EventBus) {}

  register(definition: ToolDefinition, executor: ToolExecutor): void {
    this.tools.set(definition.name, { definition, executor });
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  getAllDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map(t => t.definition);
  }

  /**
   * Get a filtered subset of tool definitions relevant to a user message.
   * Scores tools by keyword matching against their name, description, and category.
   * Always includes core tools (memory_save, memory_search) and returns up to `limit` tools.
   */
  getRelevantDefinitions(message: string, limit = 16): ToolDefinition[] {
    const all = this.getAllDefinitions();
    if (all.length <= limit) return all;

    const lower = message.toLowerCase();
    const scored = all.map(tool => {
      let score = 0;
      const name = tool.name.toLowerCase();
      const desc = (tool.description || '').toLowerCase();
      const cat = (tool.category || '').toLowerCase();

      // Exact tool name mentioned
      if (lower.includes(name)) score += 100;
      // Category mentioned
      if (cat && lower.includes(cat)) score += 30;
      // Word overlap between message and description
      const words = lower.split(/\W+/).filter(w => w.length > 2);
      for (const w of words) {
        if (name.includes(w)) score += 10;
        if (desc.includes(w)) score += 3;
      }
      // Core tools always included
      if (['memory_save', 'memory_search', 'generate_report', 'generate_chart', 'export_chat_pdf'].includes(tool.name)) {
        score += 5;
      }
      return { tool, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.tool);
  }

  getByCategory(category: string): ToolDefinition[] {
    return [...this.tools.values()]
      .filter(t => t.definition.category === category)
      .map(t => t.definition);
  }

  setApprovalCallback(cb: (tool: ToolDefinition, args: Record<string, unknown>) => Promise<boolean>): void {
    this.approvalCallback = cb;
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const registered = this.tools.get(call.name);

    if (!registered) {
      return {
        toolCallId: call.id,
        success: false,
        result: null,
        error: `Tool not found: ${call.name}`,
        duration: Date.now() - startTime,
      };
    }

    // Check approval if needed
    if (registered.definition.requiresApproval && this.approvalCallback) {
      const approved = await this.approvalCallback(registered.definition, call.arguments);
      if (!approved) {
        return {
          toolCallId: call.id,
          success: false,
          result: null,
          error: 'Tool execution denied by user',
          duration: Date.now() - startTime,
        };
      }
    }

    try {
      await this.eventBus.emit({
        type: 'tool:executing',
        payload: { tool: call.name, arguments: call.arguments },
        source: 'tool-registry',
        timestamp: new Date().toISOString(),
      });

      // Execute with timeout
      const timeout = registered.definition.timeout ?? 30000;
      const result = await Promise.race([
        registered.executor(call.arguments),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool timeout after ${timeout}ms`)), timeout)),
      ]);

      const toolResult: ToolResult = {
        toolCallId: call.id,
        success: true,
        result,
        duration: Date.now() - startTime,
      };

      await this.eventBus.emit({
        type: 'tool:completed',
        payload: { tool: call.name, result: toolResult },
        source: 'tool-registry',
        timestamp: new Date().toISOString(),
      });

      return toolResult;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const toolResult: ToolResult = {
        toolCallId: call.id,
        success: false,
        result: null,
        error,
        duration: Date.now() - startTime,
      };

      await this.eventBus.emit({
        type: 'tool:failed',
        payload: { tool: call.name, error },
        source: 'tool-registry',
        timestamp: new Date().toISOString(),
      });

      return toolResult;
    }
  }

  async executeAll(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map(c => this.execute(c)));
  }
}
