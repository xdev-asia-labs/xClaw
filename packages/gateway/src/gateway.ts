// ============================================================
// Gateway - WebSocket Control Plane (OpenClaw-style architecture)
// ============================================================

import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import pg from 'pg';
import { Agent } from '@autox/core';
import type {
  GatewayConfig, GatewayMessage, GatewaySession,
  IncomingMessage, Workflow, AgentEvent,
} from '@autox/shared';
import { SessionManager } from './session-manager.js';
import { ChannelManager } from './channel-manager.js';
import { AuthService } from './auth-service.js';
import type { AuthUser } from './auth-service.js';

interface ConnectedClient {
  ws: WebSocket;
  session: GatewaySession;
  unsubscribe: () => void;
}

// Extend Express Request with auth user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export class Gateway {
  readonly sessions: SessionManager;
  readonly channels: ChannelManager;
  readonly auth: AuthService;

  private agent: Agent;
  private config: GatewayConfig;
  private server?: http.Server;
  private wss?: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private workflowStore: Map<string, Workflow> = new Map();
  private pgPool: pg.Pool;

  constructor(agent: Agent, config: Partial<GatewayConfig> = {}) {
    this.agent = agent;
    this.config = {
      port: 18789,
      host: '127.0.0.1',
      heartbeatInterval: 30_000,
      sessionTimeout: 30 * 60_000,
      maxSessionsPerUser: 5,
      corsOrigins: ['http://localhost:3000'],
      ...config,
    };

    // Init PG pool for auth
    this.pgPool = new pg.Pool({
      connectionString: process.env.PG_CONNECTION_STRING ?? 'postgresql://autox:autox@localhost:5432/autox',
      max: 5,
    });
    this.auth = new AuthService(this.pgPool);

    this.sessions = new SessionManager(
      this.config.sessionTimeout,
      this.config.maxSessionsPerUser,
    );
    this.channels = new ChannelManager();

    // Route incoming channel messages through agent
    this.channels.onMessage(async (msg) => {
      const response = await this.agent.handleMessage(msg);
      await this.channels.send(response);
    });
  }

  // ─── Start Gateway ────────────────────────────────────────

  async start(): Promise<void> {
    const app = express();
    app.use(cors({ origin: this.config.corsOrigins }));
    app.use(express.json({ limit: '10mb' }));

    // ── Auth middleware helper ─────────────────────────────
    const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const token = header.slice(7);
      const user = await this.auth.getUserByToken(token);
      if (!user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      req.user = user;
      next();
    };

    // ── Auth routes (public) ──────────────────────────────
    app.post('/api/auth/register', async (req, res) => {
      try {
        const { username, password, displayName } = req.body;
        const result = await this.auth.register(username, password, displayName);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed' });
      }
    });

    app.post('/api/auth/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        const result = await this.auth.login(username, password);
        res.json(result);
      } catch (err) {
        res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed' });
      }
    });

    app.get('/api/auth/me', requireAuth, (req, res) => {
      res.json({ user: req.user });
    });

    app.post('/api/auth/logout', requireAuth, (req, res) => {
      const token = req.headers.authorization!.slice(7);
      this.auth.logout(token);
      res.json({ success: true });
    });

    // ── Chat history routes (protected) ────────────────────
    app.get('/api/conversations', requireAuth, async (req, res) => {
      try {
        const conversations = await this.auth.getConversations(req.user!.id);
        res.json({ conversations });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/conversations', requireAuth, async (req, res) => {
      try {
        const conv = await this.auth.createConversation(req.user!.id, req.body.title);
        res.json(conv);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.delete('/api/conversations/:id', requireAuth, async (req, res) => {
      try {
        await this.auth.deleteConversation(req.user!.id, req.params.id as string);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.patch('/api/conversations/:id', requireAuth, async (req, res) => {
      try {
        await this.auth.renameConversation(req.user!.id, req.params.id as string, req.body.title);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/conversations/:id/messages', requireAuth, async (req, res) => {
      try {
        const messages = await this.auth.getMessages(req.user!.id, req.params.id as string);
        res.json({ messages });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Protected chat endpoint - saves messages per user
    app.post('/api/chat', requireAuth, async (req, res) => {
      const { conversationId, message } = req.body;
      if (!message) { res.status(400).json({ error: 'message is required' }); return; }
      if (!conversationId) { res.status(400).json({ error: 'conversationId is required' }); return; }
      try {
        // Save user message
        await this.auth.saveMessage(conversationId, 'user', message);
        await this.auth.autoTitle(conversationId, message);

        // Get AI response
        const start = Date.now();
        const response = await this.agent.chat(conversationId, message);
        const latencyMs = Date.now() - start;

        // Save assistant message
        await this.auth.saveMessage(conversationId, 'assistant', response, { latencyMs });

        res.json({ conversationId, response });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
      }
    });

    // Health & info endpoint
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        gateway: 'autox',
        sessions: this.sessions.count,
        channels: this.channels.getAll().map(c => c.platform),
        uptime: process.uptime(),
      });
    });

    // REST convenience endpoints (delegate to WS internally)
    this.registerRestRoutes(app);

    this.server = http.createServer(app);
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws) => this.handleConnection(ws));

    // Start session cleanup
    this.sessions.startCleanup();

    // Start channel plugins
    await this.channels.startAll();

    return new Promise((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        console.log(`\n⚡ AutoX Gateway running on ws://${this.config.host}:${this.config.port}/ws`);
        console.log(`📡 REST API: http://${this.config.host}:${this.config.port}/api/health`);
        console.log(`📊 Active sessions: ${this.sessions.count}`);
        console.log(`🔌 Channels: ${this.channels.getAll().map(c => c.platform).join(', ') || 'none'}\n`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.sessions.stopCleanup();
    await this.channels.stopAll();
    await this.pgPool.end();

    // Close all WS connections
    for (const client of this.clients.values()) {
      client.unsubscribe();
      client.ws.close(1000, 'Gateway shutting down');
    }
    this.clients.clear();

    return new Promise((resolve) => {
      if (this.wss) this.wss.close();
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  // ─── WebSocket Connection Handler ─────────────────────────

  private handleConnection(ws: WebSocket): void {
    // Create a temporary session (will be upgraded on auth)
    const session = this.sessions.create('anonymous', 'web', 'ws');

    // Subscribe to agent events and forward to client
    const unsubscribe = this.agent.eventBus.on('*', async (event: AgentEvent) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: 'event',
          id: crypto.randomUUID(),
          sessionId: session.id,
          payload: { eventType: event.type, ...event.payload },
          timestamp: event.timestamp,
        });
      }
    });

    const client: ConnectedClient = { ws, session, unsubscribe };
    this.clients.set(session.id, client);

    console.log(`[Gateway] Client connected: ${session.id}`);

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, {
          type: 'ping',
          id: crypto.randomUUID(),
          payload: {},
          timestamp: new Date().toISOString(),
        });
      }
    }, this.config.heartbeatInterval);

    ws.on('message', async (raw) => {
      try {
        const msg: GatewayMessage = JSON.parse(raw.toString());
        this.sessions.touch(session.id);
        await this.handleMessage(client, msg);
      } catch (err) {
        this.sendError(ws, session.id, err instanceof Error ? err.message : 'Invalid message');
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      this.sessions.remove(session.id);
      this.clients.delete(session.id);
      console.log(`[Gateway] Client disconnected: ${session.id}`);
    });

    ws.on('error', (err) => {
      console.error(`[Gateway] WS error for ${session.id}:`, err.message);
    });
  }

  // ─── Message Router ───────────────────────────────────────

  private async handleMessage(client: ConnectedClient, msg: GatewayMessage): Promise<void> {
    const { ws, session } = client;

    switch (msg.type) {
      case 'auth': {
        const userId = msg.payload.userId as string ?? 'anonymous';
        session.userId = userId;
        if (msg.payload.platform) {
          session.platform = msg.payload.platform as typeof session.platform;
        }
        this.sendToClient(ws, {
          type: 'auth',
          id: msg.id,
          sessionId: session.id,
          payload: { authenticated: true, session },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'chat': {
        const content = msg.payload.message as string;
        if (!content) {
          this.sendError(ws, session.id, 'Message content is required');
          return;
        }
        const chatSessionId = msg.payload.chatSessionId as string ?? session.id;
        const response = await this.agent.chat(chatSessionId, content);
        this.sendToClient(ws, {
          type: 'chat:response',
          id: msg.id,
          sessionId: session.id,
          payload: { chatSessionId, content: response },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'pong': {
        // Client responded to heartbeat
        break;
      }

      case 'skill:list': {
        const skills = this.agent.skills.listAll();
        const active = this.agent.skills.listActive();
        this.sendToClient(ws, {
          type: 'skill:list',
          id: msg.id,
          sessionId: session.id,
          payload: { skills, active: active.map(s => s.id) },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'skill:toggle': {
        const skillId = msg.payload.skillId as string;
        const activate = msg.payload.activate as boolean;
        if (activate) {
          await this.agent.skills.activate(skillId, msg.payload.config as Record<string, unknown>);
        } else {
          await this.agent.skills.deactivate(skillId);
        }
        this.sendToClient(ws, {
          type: 'skill:toggle',
          id: msg.id,
          sessionId: session.id,
          payload: { skillId, active: activate, success: true },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'workflow:execute': {
        const workflowId = msg.payload.workflowId as string;
        const workflow = this.workflowStore.get(workflowId);
        if (!workflow) {
          this.sendError(ws, session.id, `Workflow not found: ${workflowId}`);
          return;
        }
        const result = await this.agent.runWorkflow(
          workflow,
          msg.payload.triggerData as Record<string, unknown>,
        );
        this.sendToClient(ws, {
          type: 'workflow:result',
          id: msg.id,
          sessionId: session.id,
          payload: { workflowId, result },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      default:
        this.sendError(ws, session.id, `Unknown message type: ${msg.type}`);
    }
  }

  // ─── REST Convenience Routes ──────────────────────────────

  private registerRestRoutes(app: express.Express): void {
    // Skills
    app.get('/api/skills', (_req, res) => {
      res.json({ skills: this.agent.skills.listAll() });
    });

    app.get('/api/skills/active', (_req, res) => {
      res.json({ skills: this.agent.skills.listActive() });
    });

    app.post('/api/skills/:id/activate', async (req, res) => {
      try {
        await this.agent.skills.activate(req.params.id, req.body.config);
        res.json({ success: true });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed' });
      }
    });

    app.post('/api/skills/:id/deactivate', async (req, res) => {
      try {
        await this.agent.skills.deactivate(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed' });
      }
    });

    // Tools
    app.get('/api/tools', (_req, res) => {
      res.json({ tools: this.agent.tools.getAllDefinitions() });
    });

    app.get('/api/tools/:category', (req, res) => {
      res.json({ tools: this.agent.tools.getByCategory(req.params.category) });
    });

    // Workflows
    app.get('/api/workflows', (_req, res) => {
      res.json({ workflows: [...this.workflowStore.values()] });
    });

    app.get('/api/workflows/:id', (req, res) => {
      const wf = this.workflowStore.get(req.params.id);
      if (!wf) return res.status(404).json({ error: 'Workflow not found' });
      res.json(wf);
    });

    app.post('/api/workflows', (req, res) => {
      const workflow: Workflow = {
        ...req.body,
        id: req.body.id ?? crypto.randomUUID(),
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.workflowStore.set(workflow.id, workflow);
      res.json(workflow);
    });

    app.put('/api/workflows/:id', (req, res) => {
      const existing = this.workflowStore.get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Workflow not found' });
      const updated: Workflow = {
        ...existing,
        ...req.body,
        id: existing.id,
        version: existing.version + 1,
        updatedAt: new Date().toISOString(),
      };
      this.workflowStore.set(updated.id, updated);
      res.json(updated);
    });

    app.delete('/api/workflows/:id', (req, res) => {
      this.workflowStore.delete(req.params.id);
      res.json({ success: true });
    });

    app.post('/api/workflows/:id/execute', async (req, res) => {
      const workflow = this.workflowStore.get(req.params.id);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      try {
        const result = await this.agent.runWorkflow(workflow, req.body.triggerData);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Execution failed' });
      }
    });

    // Agent config
    app.get('/api/agent/config', (_req, res) => {
      const config = this.agent.getConfig();
      const safe = { ...config, llm: { ...config.llm, apiKey: config.llm.apiKey ? '***' : '' } };
      res.json(safe);
    });

    app.patch('/api/agent/config', (req, res) => {
      this.agent.updateConfig(req.body);
      res.json({ success: true });
    });

    // Memory
    app.post('/api/memory/search', async (req, res) => {
      const { query, limit } = req.body;
      const results = await this.agent.memory.recall(query, limit ?? 10);
      res.json({ results });
    });

    app.post('/api/memory/save', async (req, res) => {
      const { content, type, tags } = req.body;
      const entry = await this.agent.memory.remember(content, type ?? 'fact', tags ?? []);
      res.json(entry);
    });

    // Gateway info
    app.get('/api/gateway/sessions', (_req, res) => {
      res.json({ sessions: this.sessions.getAll() });
    });

    app.get('/api/gateway/channels', (_req, res) => {
      res.json({
        channels: this.channels.getAll().map(c => ({
          id: c.id,
          platform: c.platform,
          name: c.name,
          version: c.version,
        })),
      });
    });

    // ── Model Management proxy routes ──────────────────────
    // These routes forward to the model-management skill tools via the tool registry
    const parseToolResult = (r: unknown) => {
      const tr = r as { success: boolean; result: unknown; error?: string };
      if (!tr.success) throw new Error(tr.error ?? 'Tool execution failed');
      const inner = tr.result;
      // If tool returned MCP format { content: [{ text }] }, parse the text
      if (inner && typeof inner === 'object' && 'content' in inner) {
        const content = (inner as { content: Array<{ text: string }> }).content;
        if (Array.isArray(content) && content[0]?.text) {
          try { return JSON.parse(content[0].text); } catch { return content[0].text; }
        }
      }
      // Otherwise return the raw result
      return inner;
    };

    app.get('/api/models', async (_req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'model_list', arguments: {} });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/models', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'model_create', arguments: req.body as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/models/active', async (_req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'model_get_active', arguments: {} });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/models/switch', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'model_switch', arguments: req.body as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/models/benchmark', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'model_benchmark', arguments: req.body as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/ollama/models', async (_req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'ollama_list', arguments: {} });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/mcp/servers', async (req, res) => {
      try {
        const args = req.query.domain ? { domain: req.query.domain } : {};
        const result = await this.agent.tools.execute({ id: 'rest', name: 'mcp_list', arguments: args as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/mcp/servers', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'mcp_register', arguments: req.body as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/kb/collections', async (_req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'kb_list_collections', arguments: {} });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/kb/collections', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'kb_create_collection', arguments: req.body as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/kb/search', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'kb_search', arguments: req.body as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/provider/health', async (_req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'provider_health_check', arguments: {} });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  private sendToClient(ws: WebSocket, msg: GatewayMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private sendError(ws: WebSocket, sessionId: string, message: string): void {
    this.sendToClient(ws, {
      type: 'error',
      id: crypto.randomUUID(),
      sessionId,
      payload: { error: message },
      timestamp: new Date().toISOString(),
    });
  }

  /** Broadcast a message to all connected clients */
  broadcast(msg: Omit<GatewayMessage, 'id' | 'timestamp'>): void {
    const full: GatewayMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    for (const client of this.clients.values()) {
      this.sendToClient(client.ws, full);
    }
  }

  /** Add a workflow to the store */
  addWorkflow(workflow: Workflow): void {
    this.workflowStore.set(workflow.id, workflow);
  }

  /** Get the underlying Agent */
  getAgent(): Agent {
    return this.agent;
  }
}
