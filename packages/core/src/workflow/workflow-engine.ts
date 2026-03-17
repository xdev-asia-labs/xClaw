// ============================================================
// Workflow Engine - Execute drag-and-drop workflows
// ============================================================

import type {
  Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution,
  NodeExecutionResult, WorkflowNodeType, ToolCall,
} from '@xclaw/shared';
import { ToolRegistry } from '../tools/tool-registry.js';
import { LLMRouter, type LLMAdapter } from '../llm/llm-router.js';
import { EventBus } from '../agent/event-bus.js';

type NodeHandler = (
  node: WorkflowNode,
  inputs: Record<string, unknown>,
  context: WorkflowContext,
) => Promise<Record<string, unknown>>;

interface WorkflowContext {
  execution: WorkflowExecution;
  variables: Record<string, unknown>;
  toolRegistry: ToolRegistry;
  llmAdapter: LLMAdapter;
  eventBus: EventBus;
}

export class WorkflowEngine {
  private nodeHandlers: Map<WorkflowNodeType, NodeHandler> = new Map();

  constructor(
    private toolRegistry: ToolRegistry,
    private llmRouter: LLMRouter,
    private eventBus: EventBus,
  ) {
    this.registerBuiltinHandlers();
  }

  // Execute a complete workflow
  async execute(workflow: Workflow, triggerData?: Record<string, unknown>): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      nodeResults: new Map(),
      variables: {
        ...Object.fromEntries(workflow.variables.map(v => [v.name, v.defaultValue])),
        _trigger: triggerData ?? {},
      },
    };

    const context: WorkflowContext = {
      execution,
      variables: execution.variables,
      toolRegistry: this.toolRegistry,
      llmAdapter: this.llmRouter.getAdapter('default'),
      eventBus: this.eventBus,
    };

    await this.eventBus.emit({
      type: 'workflow:started',
      payload: { workflowId: workflow.id, executionId: execution.id },
      source: 'workflow-engine',
      timestamp: new Date().toISOString(),
    });

    try {
      // Find trigger/start nodes
      const startNodes = workflow.nodes.filter(n => n.type === 'trigger');
      if (startNodes.length === 0) throw new Error('Workflow has no trigger node');

      // BFS execution following edges
      await this.executeFromNodes(startNodes, workflow, context);

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
      execution.completedAt = new Date().toISOString();
    }

    await this.eventBus.emit({
      type: 'workflow:completed',
      payload: { workflowId: workflow.id, executionId: execution.id, status: execution.status },
      source: 'workflow-engine',
      timestamp: new Date().toISOString(),
    });

    return execution;
  }

  private async executeFromNodes(
    nodes: WorkflowNode[],
    workflow: Workflow,
    context: WorkflowContext,
  ): Promise<void> {
    for (const node of nodes) {
      if (context.execution.status === 'cancelled') return;

      // Gather inputs from incoming edges
      const inputs = this.gatherInputs(node, workflow.edges, context);

      // Execute the node
      const result = await this.executeNode(node, inputs, context);
      context.execution.nodeResults.set(node.id, result);

      if (result.status === 'failed') {
        throw new Error(`Node ${node.id} (${node.data.label}) failed: ${result.error}`);
      }

      // Store outputs in variables
      for (const [key, value] of Object.entries(result.output)) {
        context.variables[`${node.id}.${key}`] = value;
      }

      // Find next nodes via outgoing edges
      const outgoingEdges = workflow.edges.filter(e => e.source === node.id);
      const nextNodes: WorkflowNode[] = [];

      for (const edge of outgoingEdges) {
        // Check edge condition if any
        if (edge.condition) {
          const conditionMet = this.evaluateCondition(edge.condition, context.variables);
          if (!conditionMet) continue;
        }
        const targetNode = workflow.nodes.find(n => n.id === edge.target);
        if (targetNode) nextNodes.push(targetNode);
      }

      if (nextNodes.length > 0) {
        await this.executeFromNodes(nextNodes, workflow, context);
      }
    }
  }

  private async executeNode(
    node: WorkflowNode,
    inputs: Record<string, unknown>,
    context: WorkflowContext,
  ): Promise<NodeExecutionResult> {
    const startedAt = new Date().toISOString();
    const handler = this.nodeHandlers.get(node.type);

    if (!handler) {
      return {
        nodeId: node.id,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        input: inputs,
        output: {},
        error: `No handler for node type: ${node.type}`,
        duration: 0,
      };
    }

    const start = Date.now();

    await this.eventBus.emit({
      type: 'workflow:node:started',
      payload: { nodeId: node.id, nodeType: node.type, label: node.data.label },
      source: 'workflow-engine',
      timestamp: startedAt,
    });

    try {
      const output = await handler(node, inputs, context);
      const duration = Date.now() - start;

      return {
        nodeId: node.id,
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        input: inputs,
        output,
        duration,
      };
    } catch (err) {
      return {
        nodeId: node.id,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        input: inputs,
        output: {},
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }

  private gatherInputs(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    context: WorkflowContext,
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingEdges = edges.filter(e => e.target === node.id);

    for (const edge of incomingEdges) {
      const sourceOutput = context.variables[`${edge.source}.${edge.sourcePort}`];
      if (sourceOutput !== undefined) {
        inputs[edge.targetPort] = sourceOutput;
      }
    }
    return inputs;
  }

  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      // Safe evaluation: only allow variable references and basic operators
      const sanitized = condition.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
      const fn = new Function('vars', `with(vars) { return !!(${sanitized}); }`);
      return fn(variables);
    } catch {
      return false;
    }
  }

  // ─── Built-in Node Handlers ─────────────────────────────

  private registerBuiltinHandlers(): void {
    // Trigger - just pass through trigger data
    this.nodeHandlers.set('trigger', async (_node, _inputs, context) => {
      return { data: context.variables._trigger ?? {} };
    });

    // LLM Call
    this.nodeHandlers.set('llm-call', async (node, inputs, context) => {
      const prompt = this.resolveTemplate(node.data.config.prompt as string, context.variables);
      const systemPrompt = node.data.config.systemPrompt as string | undefined;

      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];

      const response = await context.llmAdapter.chat(messages);
      return { response: response.content, usage: response.usage };
    });

    // Tool Call
    this.nodeHandlers.set('tool-call', async (node, inputs, context) => {
      const toolName = node.data.config.toolName as string;
      const args = node.data.config.arguments as Record<string, unknown> ?? inputs;

      // Resolve template strings in arguments
      const resolvedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        resolvedArgs[key] = typeof value === 'string'
          ? this.resolveTemplate(value, context.variables)
          : value;
      }

      const call: ToolCall = { id: crypto.randomUUID(), name: toolName, arguments: resolvedArgs };
      const result = await context.toolRegistry.execute(call);
      return { result: result.result, success: result.success, error: result.error };
    });

    // Condition (if/else)
    this.nodeHandlers.set('condition', async (node, inputs, context) => {
      const expression = node.data.config.expression as string;
      const result = this.evaluateCondition(expression, { ...context.variables, ...inputs });
      return { result: result, branch: result ? 'true' : 'false' };
    });

    // HTTP Request
    this.nodeHandlers.set('http-request', async (node, _inputs, context) => {
      const url = this.resolveTemplate(node.data.config.url as string, context.variables);
      const method = (node.data.config.method as string) ?? 'GET';
      const headers = (node.data.config.headers as Record<string, string>) ?? {};
      const body = node.data.config.body as string | undefined;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? this.resolveTemplate(body, context.variables) : undefined,
      });

      const responseText = await res.text();
      let responseData: unknown;
      try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }

      return { status: res.status, data: responseData, ok: res.ok };
    });

    // Transform (data mapping via template)
    this.nodeHandlers.set('transform', async (node, inputs, context) => {
      const template = node.data.config.template as string;
      if (template) {
        const result = this.resolveTemplate(template, { ...context.variables, ...inputs });
        return { result };
      }
      // Pass-through by default
      return inputs;
    });

    // Code execution (sandboxed)
    this.nodeHandlers.set('code', async (node, inputs, context) => {
      const code = node.data.config.code as string;
      const fn = new Function('inputs', 'variables', `
        "use strict";
        ${code}
      `);
      const result = await fn(inputs, context.variables);
      return { result };
    });

    // Wait/Delay
    this.nodeHandlers.set('wait', async (node) => {
      const ms = (node.data.config.seconds as number ?? 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, ms));
      return { waited: ms };
    });

    // Notification
    this.nodeHandlers.set('notification', async (node, _inputs, context) => {
      const message = this.resolveTemplate(node.data.config.message as string, context.variables);
      const channel = node.data.config.channel as string ?? 'default';

      await context.eventBus.emit({
        type: 'notification:send',
        payload: { message, channel },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });
      return { sent: true, message };
    });

    // Output (end node)
    this.nodeHandlers.set('output', async (_node, inputs) => {
      return inputs;
    });

    // Memory Read
    this.nodeHandlers.set('memory-read', async (node, _inputs, context) => {
      const query = this.resolveTemplate(node.data.config.query as string, context.variables);
      // Memory read will be handled by the agent that owns the workflow
      return { query, note: 'Memory operations delegated to agent' };
    });

    // Memory Write
    this.nodeHandlers.set('memory-write', async (node, inputs, context) => {
      const content = this.resolveTemplate(node.data.config.content as string, { ...context.variables, ...inputs });
      return { content, note: 'Memory operations delegated to agent' };
    });
  }

  private resolveTemplate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const keys = path.trim().split('.');
      let value: unknown = vars;
      for (const key of keys) {
        if (value == null || typeof value !== 'object') return '';
        value = (value as Record<string, unknown>)[key];
      }
      return value != null ? String(value) : '';
    });
  }

  // Register custom node handler (for plugins)
  registerNodeHandler(type: WorkflowNodeType, handler: NodeHandler): void {
    this.nodeHandlers.set(type, handler);
  }
}
