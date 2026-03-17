// ============================================================
// Gateway - WebSocket Control Plane (OpenClaw-style architecture)
// ============================================================

import http from 'http';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import pg from 'pg';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { renameSync } from 'node:fs';
import { Agent } from '@xclaw/core';
import type {
  GatewayConfig, GatewayMessage, GatewaySession,
  IncomingMessage, Workflow, AgentEvent,
} from '@xclaw/shared';
import { SessionManager } from './session-manager.js';
import { ChannelManager } from './channel-manager.js';
import { AuthService } from './auth-service.js';
import { ReportService } from './report-service.js';
import { DoctorDataService } from './doctor-data-service.js';
import { SkillHubService } from '@xclaw/skill-hub';
import PDFDocument from 'pdfkit';
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
  readonly reports: ReportService;
  readonly doctorData: DoctorDataService;
  readonly skillHub: SkillHubService;

  private agent: Agent;
  private config: GatewayConfig;
  private server?: http.Server;
  private wss?: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private workflowStore: Map<string, Workflow> = new Map();
  private pgPool: pg.Pool;
  private reportFiles: Map<string, { buffer: Buffer; filename: string; mime: string; createdAt: number }> = new Map();

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
      connectionString: process.env.PG_CONNECTION_STRING ?? 'postgresql://xclaw:xclaw@localhost:5432/xclaw',
      max: 5,
    });
    this.auth = new AuthService(this.pgPool);
    this.reports = new ReportService(this.pgPool);
    this.doctorData = new DoctorDataService(this.pgPool);
    this.skillHub = new SkillHubService({ githubToken: process.env.GITHUB_TOKEN });
    this.skillHub.setSkillManager(this.agent.skills);

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
    app.use(cors({ origin: this.config.corsOrigins.concat('*') }));
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

    // ── Admin-only middleware ──────────────────────────────
    const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }
      next();
    };

    // ── API key auth (for embeddable widget) ──────────────
    const requireApiKey = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        res.status(401).json({ error: 'API key required' });
        return;
      }
      const user = await this.auth.getUserByApiKey(apiKey);
      if (!user) {
        res.status(401).json({ error: 'Invalid API key' });
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

    // Streaming chat endpoint (SSE) - real-time token-by-token response
    app.post('/api/chat/stream', requireAuth, async (req, res) => {
      const { conversationId, message, webSearch, model } = req.body;
      if (!message) { res.status(400).json({ error: 'message is required' }); return; }
      if (!conversationId) { res.status(400).json({ error: 'conversationId is required' }); return; }

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        // If web search is enabled, search first and prepend context
        let enrichedMessage = message;
        if (webSearch) {
          try {
            res.write(`data: ${JSON.stringify({ type: 'status', content: 'Searching the web...' })}\n\n`);
            const { text: searchText, sources } = await this.performWebSearch(message);
            if (searchText) {
              enrichedMessage = `[Web Search Results]\n${searchText}\n\n[User Question]\n${message}`;
              res.write(`data: ${JSON.stringify({ type: 'search_done', sources })}\n\n`);
            }
          } catch {
            res.write(`data: ${JSON.stringify({ type: 'status', content: 'Web search failed, answering without it.' })}\n\n`);
          }
        }

        await this.auth.saveMessage(conversationId, 'user', message);
        await this.auth.autoTitle(conversationId, message);

        const start = Date.now();
        let fullContent = '';

        for await (const chunk of this.agent.chatStream(conversationId, enrichedMessage)) {
          if (chunk.type === 'delta') {
            fullContent += chunk.content;
            res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk.content })}\n\n`);
          } else if (chunk.type === 'tool') {
            res.write(`data: ${JSON.stringify({ type: 'tool', content: chunk.content })}\n\n`);
          } else if (chunk.type === 'rag_context') {
            // Forward RAG context to admin clients for debug panel
            if (req.user?.role === 'admin') {
              res.write(`data: ${JSON.stringify({ type: 'rag_context', content: chunk.content })}\n\n`);
            }
          } else if (chunk.type === 'done') {
            const latencyMs = Date.now() - start;
            await this.auth.saveMessage(conversationId, 'assistant', fullContent, { latencyMs });
            res.write(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`);
          }
        }
      } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: err instanceof Error ? err.message : 'Unknown error' })}\n\n`);
      } finally {
        res.end();
      }
    });

    // Web search endpoint
    app.post('/api/web-search', requireAuth, async (req, res) => {
      const { query } = req.body;
      if (!query) { res.status(400).json({ error: 'query is required' }); return; }
      try {
        const results = await this.performWebSearch(query);
        res.json({ results });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Search failed' });
      }
    });

    // Health & info endpoint
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        gateway: 'xclaw',
        sessions: this.sessions.count,
        channels: this.channels.getAll().map(c => c.platform),
        uptime: process.uptime(),
      });
    });

    // ── Version check endpoint ────────────────────────────
    app.get('/api/version', (_req, res) => {
      const pkg = { version: '0.2.0' }; // from package.json at build
      res.json({ version: pkg.version });
    });

    app.get('/api/version/check', async (_req, res) => {
      try {
        const currentVersion = '0.2.0';
        const remote = await fetch('https://xclaw.xdev.asia/api/versions.json');
        if (!remote.ok) { res.status(502).json({ error: 'Cannot reach version server' }); return; }
        const info = await remote.json() as Record<string, unknown>;
        const latest = String(info.latest ?? currentVersion);
        const minimum = String(info.minimum ?? '0.0.0');
        const cmp = (a: string, b: string) => {
          const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
          for (let i = 0; i < 3; i++) { if ((pa[i]??0) < (pb[i]??0)) return -1; if ((pa[i]??0) > (pb[i]??0)) return 1; }
          return 0;
        };
        res.json({
          currentVersion,
          latestVersion: latest,
          hasUpdate: cmp(currentVersion, latest) < 0,
          isOutdated: cmp(currentVersion, minimum) < 0,
          releaseNotes: info.releaseNotes ?? '',
          changelog: info.changelog ?? '',
          updateCommand: info.updateCommand ?? '',
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Version check failed' });
      }
    });

    // ── Agent registry proxy ──────────────────────────────
    app.get('/api/agent-registry', async (_req, res) => {
      try {
        const remote = await fetch('https://xclaw.xdev.asia/api/agent-registry.json');
        if (!remote.ok) { res.status(502).json({ error: 'Cannot reach registry' }); return; }
        const registry = await remote.json();
        res.json(registry);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Registry fetch failed' });
      }
    });

    // ── Feedback endpoint ─────────────────────────────────
    app.post('/api/chat/feedback', requireAuth, async (req, res) => {
      try {
        const { messageId, rating, comment } = req.body;
        if (!messageId || !['up', 'down'].includes(rating)) {
          res.status(400).json({ error: 'messageId and rating (up/down) required' });
          return;
        }
        await this.pgPool.query(
          `INSERT INTO message_feedback (id, message_id, user_id, rating, comment, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (message_id, user_id) DO UPDATE SET rating = $4, comment = $5`,
          [crypto.randomUUID(), messageId, req.user!.id, rating, comment || null],
        );
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Doctor data & admin routes (protected) ────────────
    this.registerDoctorRoutes(app, requireAuth, requireAdmin);
    this.registerAdminRoutes(app, requireAuth, requireAdmin);

    // ── Embeddable widget routes ──────────────────────────
    this.registerEmbedRoutes(app, requireAuth, requireApiKey);

    // REST convenience endpoints (delegate to WS internally)
    this.registerRestRoutes(app);

    // ── Report file download route (authenticated) ────────
    app.get('/api/reports/download/:id', requireAuth, (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const file = this.reportFiles.get(id);
      if (!file) { res.status(404).json({ error: 'Report expired or not found' }); return; }
      res.setHeader('Content-Type', file.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.send(file.buffer);
    });

    // ── Register report generation tool on agent ──────────
    this.agent.tools.register(
      {
        name: 'generate_report',
        description: 'Generate analytics reports about platform usage, chat activity, and user engagement. Supports text (Markdown), Excel (.xlsx), and PDF formats. For Excel/PDF, returns a download link.',
        category: 'admin',
        parameters: [
          { name: 'type', type: 'string', description: 'Report type: "summary" (platform overview) or "user-activity" (per-user breakdown)', required: false, default: 'summary', enum: ['summary', 'user-activity'] },
          { name: 'days', type: 'number', description: 'Number of days to include in the report (1-365)', required: false, default: 7 },
          { name: 'format', type: 'string', description: 'Output format: "text" (Markdown), "excel" (.xlsx spreadsheet), or "pdf" (PDF document)', required: false, default: 'text', enum: ['text', 'excel', 'pdf'] },
        ],
        returns: { name: 'report', type: 'string', description: 'Formatted Markdown report text, or a Markdown download link for Excel/PDF' },
      },
      async (args) => {
        const type = (args.type as string) || 'summary';
        const days = Math.min(Math.max(Number(args.days) || 7, 1), 365);
        const format = (args.format as string) || 'text';

        if (format === 'excel' || format === 'pdf') {
          const buffer = format === 'excel'
            ? await this.reports.generateExcel(type, days)
            : await this.reports.generatePdf(type, days);
          const fileId = crypto.randomUUID();
          const ext = format === 'excel' ? 'xlsx' : 'pdf';
          const mime = format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf';
          const filename = `report-${type}-${days}d.${ext}`;
          this.reportFiles.set(fileId, { buffer, filename, mime, createdAt: Date.now() });
          // Auto-cleanup after 10 minutes
          setTimeout(() => this.reportFiles.delete(fileId), 10 * 60_000);
          const url = `/api/reports/download/${fileId}`;
          return `Report generated successfully. Download here: [📊 ${filename}](${url})`;
        }

        return await this.reports.generateTextReport(type, days);
      },
    );

    // ── Register data evaluation tool on agent ──────────
    this.agent.tools.register(
      {
        name: 'evaluate_learning_data',
        description: 'Evaluate the quality and correctness of doctor learning data entries. Can review individual entries or batch-analyze data quality. Returns accuracy assessments, discrepancies, and recommendations. Use this when asked to check if learning data is correct or incorrect (đánh giá dữ liệu đúng hay sai).',
        category: 'admin',
        parameters: [
          { name: 'action', type: 'string', description: 'Action: "evaluate_entry" (single entry), "batch_evaluate" (multiple entries), "quality_report" (overall quality stats), "compare" (compare entry against best practices)', required: true, enum: ['evaluate_entry', 'batch_evaluate', 'quality_report', 'compare'] },
          { name: 'entry_id', type: 'string', description: 'Learning entry ID (for evaluate_entry/compare)', required: false },
          { name: 'doctor_id', type: 'string', description: 'Doctor ID to filter entries (for batch_evaluate)', required: false },
          { name: 'status', type: 'string', description: 'Filter by status: auto_detected, doctor_confirmed, admin_verified, rejected', required: false, enum: ['auto_detected', 'doctor_confirmed', 'admin_verified', 'rejected'] },
          { name: 'type', type: 'string', description: 'Filter by type: preference, correction, knowledge, decision_pattern', required: false, enum: ['preference', 'correction', 'knowledge', 'decision_pattern'] },
          { name: 'days', type: 'number', description: 'Number of days to look back (for batch_evaluate/quality_report)', required: false, default: 30 },
          { name: 'limit', type: 'number', description: 'Max entries to evaluate (for batch_evaluate)', required: false, default: 20 },
          { name: 'new_status', type: 'string', description: 'Approve or reject an entry: admin_verified, rejected', required: false, enum: ['admin_verified', 'rejected'] },
        ],
        returns: { name: 'evaluation', type: 'object', description: 'Evaluation results with accuracy assessment, issues found, and recommendations' },
      },
      async (args) => {
        const action = args.action as string;

        if (action === 'evaluate_entry') {
          const entryId = args.entry_id as string;
          if (!entryId) return { error: 'entry_id is required for evaluate_entry' };
          const entry = await this.doctorData.getLearningEntry(entryId);
          if (!entry) return { error: `Learning entry not found: ${entryId}` };

          // If new_status is provided, update the entry
          if (args.new_status) {
            const updated = await this.doctorData.updateLearningEntryStatus(entryId, args.new_status as string);
            return {
              action: 'status_updated',
              entry_id: entryId,
              old_status: entry.status,
              new_status: args.new_status,
              entry: {
                type: updated.type,
                category: updated.category,
                content: updated.content,
                context: updated.context,
                confidence: updated.confidence,
                status: updated.status,
                tags: updated.tags,
              },
            };
          }

          return {
            action: 'evaluate_entry',
            entry: {
              id: entry.id,
              type: entry.type,
              category: entry.category,
              content: entry.content,
              context: entry.context,
              confidence: entry.confidence,
              status: entry.status,
              tags: entry.tags,
              created_at: entry.created_at,
              doctor_name: entry.doctor_name,
            },
            evaluation: {
              confidence_level: entry.confidence >= 0.8 ? 'high' : entry.confidence >= 0.6 ? 'medium' : 'low',
              has_context: (entry.context?.length ?? 0) > 20,
              content_length: entry.content.length,
              has_tags: (entry.tags?.length ?? 0) > 0,
            },
            instruction: 'Review the content and context above. Assess if this learning entry is medically accurate and relevant. Recommend admin_verified or rejected.',
          };
        }

        if (action === 'batch_evaluate') {
          const result = await this.doctorData.getLearningEntries({
            doctor_id: args.doctor_id as string,
            status: args.status as string,
            type: args.type as string,
            limit: Math.min(Number(args.limit) || 20, 50),
          });
          const entries = result.entries;
          return {
            action: 'batch_evaluate',
            total: entries.length,
            entries: entries.map((e) => ({
              id: e.id,
              type: e.type,
              category: e.category,
              content: (e.content ?? '').substring(0, 200),
              confidence: e.confidence,
              status: e.status,
              tags: e.tags,
              created_at: e.created_at,
            })),
            summary: {
              by_type: Object.entries(
                entries.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {} as Record<string, number>)
              ).map(([type, count]) => ({ type, count })),
              avg_confidence: entries.length > 0
                ? Math.round((entries.reduce((s, e) => s + (e.confidence || 0), 0) / entries.length) * 100) / 100
                : 0,
              low_confidence_count: entries.filter((e) => (e.confidence || 0) < 0.6).length,
            },
            instruction: 'Review each entry above. For medical accuracy evaluation, consider the content, confidence score, and type. Flag entries that seem incorrect or suspicious.',
          };
        }

        if (action === 'quality_report') {
          const days = Math.min(Math.max(Number(args.days) || 30, 1), 365);
          const stats = await this.doctorData.getDataQualityStats(days);
          return {
            action: 'quality_report',
            period_days: days,
            stats: {
              total_entries: stats.total_learning_entries,
              pending_review: stats.pending_review,
              approved: stats.approved,
              rejected: stats.rejected,
              approval_rate: stats.total_learning_entries > 0
                ? Math.round((stats.approved / stats.total_learning_entries) * 100) : 0,
              rejection_rate: stats.total_learning_entries > 0
                ? Math.round((stats.rejected / stats.total_learning_entries) * 100) : 0,
              avg_confidence: Math.round(stats.avg_confidence * 100) / 100,
              active_doctors: stats.active_doctors,
              by_type: stats.by_type,
              by_category: stats.by_category,
              quality_trend: stats.quality_trend.slice(-14),
            },
            instruction: 'Present this quality report to the user. Highlight areas needing attention: high pending count, low confidence entries, or declining quality trends.',
          };
        }

        if (action === 'compare') {
          const entryId = args.entry_id as string;
          if (!entryId) return { error: 'entry_id is required for compare' };
          const entry = await this.doctorData.getLearningEntry(entryId);
          if (!entry) return { error: `Learning entry not found: ${entryId}` };
          return {
            action: 'compare',
            entry: {
              id: entry.id,
              type: entry.type,
              content: entry.content,
              context: entry.context,
              confidence: entry.confidence,
            },
            instruction: 'Compare this medical content against current clinical guidelines and best practices. Assess correctness and provide a verdict: correct, partially_correct, or incorrect, with reasoning.',
          };
        }

        return { error: `Unknown action: ${action}` };
      },
    );

    // ── Register chart generation tool on agent ───────────
    this.agent.tools.register(
      {
        name: 'generate_chart',
        description: 'Generate interactive charts and visualizations from data. Returns chart data in a special format that will be rendered as a visual chart in the chat. Supports bar, line, pie, area, and radar charts. Use this when users ask for visual reports, graphs, or data visualization (vẽ biểu đồ, báo cáo trực quan).',
        category: 'analytics',
        parameters: [
          { name: 'chart_type', type: 'string', description: 'Chart type: bar, line, pie, area, radar', required: true, enum: ['bar', 'line', 'pie', 'area', 'radar'] },
          { name: 'title', type: 'string', description: 'Chart title', required: true },
          { name: 'data', type: 'array', description: 'Array of data points. Each item is an object with key-value pairs. E.g. [{"name":"Mon","value":10},{"name":"Tue","value":20}]', required: true },
          { name: 'x_key', type: 'string', description: 'Key in data objects for x-axis/labels (default: "name")', required: false, default: 'name' },
          { name: 'y_keys', type: 'array', description: 'Keys in data objects for y-axis values. E.g. ["value"] or ["sales","profit"]', required: false },
          { name: 'colors', type: 'array', description: 'Colors for each series. E.g. ["#8884d8","#82ca9d"]', required: false },
          { name: 'width', type: 'number', description: 'Chart width in pixels (default: 500)', required: false, default: 500 },
          { name: 'height', type: 'number', description: 'Chart height in pixels (default: 300)', required: false, default: 300 },
        ],
        returns: { name: 'chart', type: 'string', description: 'Chart specification in a special markdown format that renders as a chart' },
      },
      async (args) => {
        const chartType = args.chart_type as string;
        const title = args.title as string;
        let data = args.data as Record<string, unknown>[] | string;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { data = []; }
        }
        if (!Array.isArray(data)) data = [];
        const xKey = (args.x_key as string) || 'name';
        const width = Number(args.width) || 500;
        const height = Number(args.height) || 300;

        // Infer y_keys from data if not provided
        let yKeys = args.y_keys as string[] | undefined;
        if ((!yKeys || yKeys.length === 0) && data.length > 0) {
          yKeys = Object.keys(data[0]).filter(k => k !== xKey && typeof data[0][k] === 'number');
        }

        const defaultColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
        const colors = (Array.isArray(args.colors) && args.colors.length > 0) ? args.colors as string[] : defaultColors;

        const chartSpec = {
          type: chartType,
          title,
          data,
          xKey,
          yKeys: yKeys || ['value'],
          colors: colors.slice(0, (yKeys || ['value']).length),
          width,
          height,
        };

        // Return as a special code block that ChatPanel can detect and render
        return '```xclaw-chart\n' + JSON.stringify(chartSpec, null, 2) + '\n```';
      },
    );

    // ── Register PDF export tool on agent ──────────────────
    this.agent.tools.register(
      {
        name: 'export_chat_pdf',
        description: 'Export conversation content, data analysis, or custom content as a downloadable PDF file. Use when users ask to export to PDF, print, or download their conversation (xuất file PDF).',
        category: 'export',
        parameters: [
          { name: 'content_type', type: 'string', description: 'Type of content to export: "conversation" (current chat), "custom" (provided content), "doctor_report" (doctor learning analytics)', required: true, enum: ['conversation', 'custom', 'doctor_report'] },
          { name: 'title', type: 'string', description: 'PDF document title', required: false, default: 'xClaw Report' },
          { name: 'content', type: 'string', description: 'Custom content (Markdown text) to export as PDF. Required for content_type="custom"', required: false },
          { name: 'conversation_id', type: 'string', description: 'Conversation ID to export (for content_type="conversation")', required: false },
          { name: 'doctor_id', type: 'string', description: 'Doctor ID for doctor_report', required: false },
          { name: 'days', type: 'number', description: 'Days to include for doctor_report (default: 30)', required: false, default: 30 },
        ],
        returns: { name: 'pdf', type: 'string', description: 'Markdown download link to the generated PDF file' },
      },
      async (args) => {
        const contentType = args.content_type as string;
        const title = (args.title as string) || 'xClaw Report';

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').fillColor('#666')
          .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(1);
        doc.fillColor('#000');

        if (contentType === 'conversation') {
          const convId = args.conversation_id as string;
          if (!convId) {
            doc.fontSize(12).text('No conversation ID provided. Please specify a conversation to export.');
          } else {
            const messagesResult = await this.pgPool.query(
              `SELECT m.role, m.content, m.created_at
               FROM chat_messages m
               WHERE m.conversation_id = $1
               ORDER BY m.created_at ASC`,
              [convId],
            );
            if (messagesResult.rows.length === 0) {
              doc.fontSize(12).text('No messages found for this conversation.');
            } else {
              for (const msg of messagesResult.rows) {
                const label = msg.role === 'user' ? 'You' : 'xClaw';
                const time = new Date(msg.created_at).toLocaleTimeString();
                doc.fontSize(10).font('Helvetica-Bold').text(`${label} [${time}]:`);
                doc.fontSize(10).font('Helvetica').text(msg.content || '(empty)', { indent: 10 });
                doc.moveDown(0.5);
                if (doc.y > 750) doc.addPage();
              }
            }
          }
        } else if (contentType === 'doctor_report') {
          const doctorId = args.doctor_id as string;
          const days = Math.min(Math.max(Number(args.days) || 30, 1), 365);
          if (!doctorId) {
            doc.fontSize(12).text('No doctor ID provided.');
          } else {
            const analysis = await this.doctorData.getDoctorChatAnalysis(doctorId, days);
            doc.fontSize(14).font('Helvetica-Bold').text('Doctor Learning Analytics');
            doc.moveDown(0.5);

            const metrics = [
              ['Total Conversations', String(analysis.total_conversations)],
              ['Total Messages', String(analysis.total_messages)],
              ['Learning Entries', String(analysis.total_learnings)],
              ['Correction Rate', `${(analysis.correction_rate * 100).toFixed(1)}%`],
              ['Avg Satisfaction', analysis.avg_satisfaction.toFixed(2)],
            ];
            for (const [label, value] of metrics) {
              doc.fontSize(10).font('Helvetica-Bold').text(`${label}: `, { continued: true });
              doc.font('Helvetica').text(value);
            }
            doc.moveDown(0.5);

            if (analysis.topics.length > 0) {
              doc.fontSize(12).font('Helvetica-Bold').text('Top Topics');
              doc.moveDown(0.3);
              for (const t of analysis.topics.slice(0, 10)) {
                doc.fontSize(10).font('Helvetica').text(`  • ${t.topic}: ${t.count} conversations`);
              }
              doc.moveDown(0.5);
            }

            if (analysis.timeline.length > 0) {
              doc.fontSize(12).font('Helvetica-Bold').text('Recent Conversations');
              doc.moveDown(0.3);
              for (const t of analysis.timeline.slice(0, 15)) {
                const date = new Date(t.created_at).toLocaleDateString();
                doc.fontSize(9).font('Helvetica')
                  .text(`  ${date} — ${t.title} (${t.message_count} msgs, ${t.learning_count} learnings${t.has_correction ? ', has corrections' : ''})`);
                if (doc.y > 750) doc.addPage();
              }
            }
          }
        } else {
          // Custom content
          const content = (args.content as string) || 'No content provided.';
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.startsWith('# ')) {
              doc.moveDown(0.5);
              doc.fontSize(16).font('Helvetica-Bold').text(line.substring(2));
              doc.moveDown(0.3);
            } else if (line.startsWith('## ')) {
              doc.moveDown(0.3);
              doc.fontSize(13).font('Helvetica-Bold').text(line.substring(3));
              doc.moveDown(0.2);
            } else if (line.startsWith('### ')) {
              doc.fontSize(11).font('Helvetica-Bold').text(line.substring(4));
              doc.moveDown(0.1);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              doc.fontSize(10).font('Helvetica').text(`  • ${line.substring(2)}`, { indent: 10 });
            } else if (line.startsWith('|')) {
              doc.fontSize(9).font('Courier').text(line);
            } else if (line.trim() === '') {
              doc.moveDown(0.3);
            } else {
              doc.fontSize(10).font('Helvetica').text(line);
            }
            if (doc.y > 750) doc.addPage();
          }
        }

        doc.end();
        const buffer = Buffer.concat(chunks);

        const fileId = crypto.randomUUID();
        const filename = `${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;
        this.reportFiles.set(fileId, { buffer, filename, mime: 'application/pdf', createdAt: Date.now() });
        setTimeout(() => this.reportFiles.delete(fileId), 10 * 60_000);

        const url = `/api/reports/download/${fileId}`;
        return `PDF generated successfully. Download here: [📄 ${filename}](${url})`;
      },
    );

    // ── Serve static web frontend (production) ────────────
    const webDistPath = new URL('../../web/dist', import.meta.url).pathname;
    app.use(express.static(webDistPath));
    app.get('/{*path}', (_req, res) => {
      res.sendFile('index.html', { root: webDistPath });
    });

    this.server = http.createServer(app);
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws) => this.handleConnection(ws));

    // Start session cleanup
    this.sessions.startCleanup();

    // Start channel plugins
    await this.channels.startAll();

    return new Promise((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        console.log(`\n⚡ xClaw Gateway running on ws://${this.config.host}:${this.config.port}/ws`);
        console.log(`📡 REST API: http://${this.config.host}:${this.config.port}/api/health`);
        console.log(`📊 Active sessions: ${this.sessions.count}`);
        console.log(`🔌 Channels: ${this.channels.getAll().map(c => c.platform).join(', ') || 'none'}\n`);
        resolve();
      });
    });
  }

  // ─── Web Search ──────────────────────────────────────────

  private async performWebSearch(query: string): Promise<{ text: string; sources: { title: string; snippet: string; url: string }[] }> {
    const encoded = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encoded}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    const html = await res.text();

    // Extract search results from DuckDuckGo HTML
    const results: { title: string; snippet: string; url: string }[] = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
      const rawUrl = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const snippet = match[3].replace(/<[^>]+>/g, '').trim();
      const actualUrl = rawUrl.includes('uddg=') ? decodeURIComponent(rawUrl.split('uddg=')[1]?.split('&')[0] || rawUrl) : rawUrl;
      if (title && snippet) {
        results.push({ title, snippet, url: actualUrl });
      }
    }

    // Fallback: simpler extraction if the above didn't work
    if (results.length === 0) {
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = snippetRegex.exec(html)) !== null && results.length < 5) {
        const snippet = match[1].replace(/<[^>]+>/g, '').trim();
        if (snippet) results.push({ title: `Result ${results.length + 1}`, snippet, url: '' });
      }
    }

    if (results.length === 0) return { text: '', sources: [] };
    const text = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}${r.url ? `\nSource: ${r.url}` : ''}`).join('\n\n');
    return { text, sources: results };
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

    app.patch('/api/mcp/servers/:id/toggle', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'mcp_toggle', arguments: { server_id: req.params.id, enabled: req.body.enabled } });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/mcp/servers/:id/health', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'mcp_health', arguments: { server_id: req.params.id } });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Knowledge Base (RAG) endpoints ────────────────────
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

    app.delete('/api/kb/collections/:id', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'kb_delete_collection', arguments: { collection_id: req.params.id } });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/kb/collections/:id/documents', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({ id: 'rest', name: 'kb_list_documents', arguments: { collection_id: req.params.id } });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/kb/collections/:id/documents', async (req, res) => {
      try {
        const args = { ...req.body, collection_id: req.params.id };
        const result = await this.agent.tools.execute({ id: 'rest', name: 'kb_add_document', arguments: args as Record<string, unknown> });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.delete('/api/kb/collections/:collectionId/documents/:docId', async (req, res) => {
      try {
        const result = await this.agent.tools.execute({
          id: 'rest', name: 'kb_delete_document',
          arguments: { collection_id: req.params.collectionId, document_id: req.params.docId },
        });
        res.json(parseToolResult(result));
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── KB file upload endpoint ────────────────────────
    const upload = multer({
      dest: join(tmpdir(), 'xclaw-uploads'),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.txt', '.md', '.csv', '.json', '.xlsx', '.xls', '.docx', '.xml', '.html', '.yaml', '.yml'];
        const ext = '.' + (file.originalname.split('.').pop()?.toLowerCase() ?? '');
        cb(null, allowed.includes(ext));
      },
    });

    app.post('/api/kb/collections/:id/upload', upload.single('file'), async (req, res) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'No file uploaded or unsupported format' });
          return;
        }

        // Rename temp file to preserve original extension (needed by document parser)
        const origExt = extname(file.originalname).toLowerCase();
        const newPath = file.path + origExt;
        renameSync(file.path, newPath);

        const collectionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const args = {
          collection_id: collectionId,
          source: 'file' as const,
          input: newPath,
          name: req.body?.name || file.originalname,
        };

        const result = await this.agent.tools.execute({ id: 'rest', name: 'kb_add_document', arguments: args as Record<string, unknown> });
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

    // ── Resource Dashboard endpoints ───────────────────────
    app.get('/api/resources/overview', async (_req, res) => {
      try {
        // Fast path: get tools/skills synchronously, run DB queries in parallel
        const tools = this.agent.tools.getAllDefinitions();
        const activeSkills = this.agent.skills.listActive();

        // Race health check with a 4s timeout to avoid blocking the whole response
        const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
          Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), ms))]);

        const [modelsResult, kbResult, healthResult] = await Promise.allSettled([
          this.agent.tools.execute({ id: 'rest', name: 'model_list', arguments: {} }),
          this.agent.tools.execute({ id: 'rest', name: 'kb_list_collections', arguments: {} }),
          withTimeout(
            this.agent.tools.execute({ id: 'rest', name: 'provider_health_check', arguments: {} }),
            4000,
            { toolCallId: 'health-timeout', success: true, duration: 4000, result: { content: [{ text: JSON.stringify({ overall: 'unknown', postgres: { status: 'timeout' }, mongodb: { status: 'timeout' }, ollama: { status: 'timeout' }, timestamp: new Date().toISOString() }) }] } },
          ),
        ]);

        const models = modelsResult.status === 'fulfilled' ? parseToolResult(modelsResult.value) : { models: [] };
        const kb = kbResult.status === 'fulfilled' ? parseToolResult(kbResult.value) : { total: 0, collections: [] };
        const health = healthResult.status === 'fulfilled' ? parseToolResult(healthResult.value) : {};

        res.json({
          models: models.models ?? [],
          knowledgeBase: {
            totalCollections: kb.total ?? kb.collections?.length ?? 0,
            collections: kb.collections ?? [],
          },
          health,
          tools: { total: tools.length },
          skills: { total: activeSkills.length, active: activeSkills.map((s: { name: string }) => s.name) },
          gateway: {
            sessions: this.sessions.count,
            uptime: process.uptime(),
          },
        });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── SkillHub marketplace routes ────────────────────────

    // Search / list skills
    app.get('/api/hub/skills', async (req, res) => {
      try {
        const params = {
          query: req.query.q as string | undefined,
          category: req.query.category as string | undefined,
          source: req.query.source as string | undefined,
          tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
          sortBy: (req.query.sortBy as 'featured' | 'popular' | 'recent' | 'rating' | 'name') ?? 'featured',
          page: req.query.page ? Number(req.query.page) : 1,
          pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
        };
        const result = await this.skillHub.search(params);
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Search failed' }); }
    });

    // Get skill detail
    app.get('/api/hub/skills/:id(*)', async (req, res) => {
      try {
        const skill = await this.skillHub.getSkill(req.params.id);
        if (!skill) return res.status(404).json({ error: 'Skill not found' });
        res.json(skill);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // Get reviews for a skill
    app.get('/api/hub/skills/:id(*)/reviews', async (req, res) => {
      try {
        const reviews = await this.skillHub.getReviews(req.params.id);
        res.json({ reviews });
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // Install skill from registry
    app.post('/api/hub/skills/:id(*)/install', async (req, res) => {
      try {
        const result = await this.skillHub.installSkill(req.params.id);
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Install failed' }); }
    });

    // Uninstall skill
    app.delete('/api/hub/skills/:id(*)/uninstall', async (req, res) => {
      try {
        const result = await this.skillHub.uninstallSkill(req.params.id);
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Uninstall failed' }); }
    });

    // Add review
    app.post('/api/hub/skills/:id(*)/reviews', async (req, res) => {
      try {
        const { rating, comment, author } = req.body;
        const review = await this.skillHub.addReview(req.params.id, rating, comment, author);
        res.json(review);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // Featured & trending
    app.get('/api/hub/featured', async (_req, res) => {
      try {
        const skills = await this.skillHub.getFeatured();
        res.json({ skills });
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    app.get('/api/hub/trending', async (_req, res) => {
      try {
        const skills = await this.skillHub.getTrending();
        res.json({ skills });
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    app.get('/api/hub/stats', async (_req, res) => {
      try {
        const stats = await this.skillHub.getStats();
        res.json(stats);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // Anthropic import
    app.get('/api/hub/import/anthropic', async (_req, res) => {
      try {
        const skills = await this.skillHub.listAnthropicSkills();
        res.json({ skills });
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    app.post('/api/hub/import/anthropic/sync', async (_req, res) => {
      try {
        const result = await this.skillHub.importAllAnthropicSkills();
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Sync failed' }); }
    });

    app.post('/api/hub/import/anthropic/:name', async (req, res) => {
      try {
        const result = await this.skillHub.importAnthropicSkill(req.params.name);
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Import failed' }); }
    });

    // MCP import
    app.post('/api/hub/import/mcp', async (req, res) => {
      try {
        const result = await this.skillHub.importMcpServer(req.body.packageName);
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Import failed' }); }
    });

    // Skill submission (community)
    app.post('/api/hub/submit', async (req, res) => {
      try {
        const { manifest, author, readme } = req.body;
        const result = await this.skillHub.submitSkill(manifest, author, readme);
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Submission failed' }); }
    });

    app.get('/api/hub/submissions', async (_req, res) => {
      try {
        const submissions = await this.skillHub.getPendingSubmissions();
        res.json({ submissions });
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    app.patch('/api/hub/submissions/:id', async (req, res) => {
      try {
        const { action, reviewer, feedback } = req.body;
        const result = await this.skillHub.reviewSubmission(req.params.id, action, reviewer, feedback);
        res.json(result);
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Review failed' }); }
    });

    // Check for updates
    app.get('/api/hub/updates', async (_req, res) => {
      try {
        const updates = await this.skillHub.checkForUpdates();
        res.json({ updates });
      } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' }); }
    });
  }

  // ─── Doctor Data & Learning Routes ───────────────────────

  private registerDoctorRoutes(
    app: express.Express,
    requireAuth: express.RequestHandler,
    requireAdmin: express.RequestHandler,
  ): void {
    // ── Doctor Profiles ───────────────────────────────────
    app.get('/api/admin/doctors', requireAuth, requireAdmin, async (_req, res) => {
      try {
        const profiles = await this.doctorData.getDoctorProfiles();
        res.json({ profiles });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/admin/doctors/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        const p = await this.doctorData.getDoctorProfileById(req.params.id as string);
        if (!p) { res.status(404).json({ error: 'Doctor profile not found' }); return; }
        res.json(p);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/admin/doctors', requireAuth, requireAdmin, async (req, res) => {
      try {
        const profile = await this.doctorData.createDoctorProfile(req.body);
        res.status(201).json(profile);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.patch('/api/admin/doctors/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        const profile = await this.doctorData.updateDoctorProfile(req.params.id as string, req.body);
        res.json(profile);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/admin/doctors/:id/stats', requireAuth, requireAdmin, async (req, res) => {
      try {
        const stats = await this.doctorData.getDoctorStats(req.params.id as string);
        res.json(stats);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── My doctor profile (for logged-in doctor) ─────────
    app.get('/api/doctor/profile', requireAuth, async (req, res) => {
      try {
        const p = await this.doctorData.getDoctorProfileByUserId(req.user!.id);
        if (!p) { res.status(404).json({ error: 'No doctor profile' }); return; }
        res.json(p);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Learning Entries ──────────────────────────────────
    app.get('/api/admin/learning', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { doctor_id, status, type, limit, offset } = req.query as Record<string, string>;
        const result = await this.doctorData.getLearningEntries({
          doctor_id,
          status,
          type,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
        });
        res.json(result);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/admin/learning', requireAuth, requireAdmin, async (req, res) => {
      try {
        const entry = await this.doctorData.createLearningEntry(req.body);
        res.status(201).json(entry);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.patch('/api/admin/learning/:id/status', requireAuth, requireAdmin, async (req, res) => {
      try {
        const entry = await this.doctorData.updateLearningEntryStatus(
          req.params.id as string, req.body.status, req.user!.id,
        );
        res.json(entry);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Doctor's own learning entries
    app.get('/api/doctor/learning', requireAuth, async (req, res) => {
      try {
        const profile = await this.doctorData.getDoctorProfileByUserId(req.user!.id);
        if (!profile) { res.status(404).json({ error: 'No doctor profile' }); return; }
        const { status, type, limit, offset } = req.query as Record<string, string>;
        const result = await this.doctorData.getLearningEntries({
          doctor_id: profile.id,
          status,
          type,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
        });
        res.json(result);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.patch('/api/doctor/learning/:id/confirm', requireAuth, async (req, res) => {
      try {
        const entry = await this.doctorData.getLearningEntry(req.params.id as string);
        if (!entry) { res.status(404).json({ error: 'Not found' }); return; }
        const profile = await this.doctorData.getDoctorProfileByUserId(req.user!.id);
        if (!profile || entry.doctor_id !== profile.id) {
          res.status(403).json({ error: 'Not your learning entry' }); return;
        }
        const updated = await this.doctorData.updateLearningEntryStatus(
          req.params.id as string, req.body.status, req.user!.id,
        );
        res.json(updated);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Data Quality ──────────────────────────────────────
    app.get('/api/admin/data-quality', requireAuth, requireAdmin, async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const stats = await this.doctorData.getDataQualityStats(days);
        res.json(stats);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Fine-Tune Datasets ────────────────────────────────
    app.get('/api/admin/finetune/datasets', requireAuth, requireAdmin, async (_req, res) => {
      try {
        const datasets = await this.doctorData.getFineTuneDatasets();
        res.json({ datasets });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/admin/finetune/datasets/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        const ds = await this.doctorData.getFineTuneDataset(req.params.id as string);
        if (!ds) { res.status(404).json({ error: 'Dataset not found' }); return; }
        res.json(ds);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/admin/finetune/datasets', requireAuth, requireAdmin, async (req, res) => {
      try {
        const ds = await this.doctorData.createFineTuneDataset({
          ...req.body, created_by: req.user!.id,
        });
        res.status(201).json(ds);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.patch('/api/admin/finetune/datasets/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        const ds = await this.doctorData.updateFineTuneDataset(req.params.id as string, req.body);
        res.json(ds);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.delete('/api/admin/finetune/datasets/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        await this.doctorData.deleteFineTuneDataset(req.params.id as string);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Fine-Tune Samples ─────────────────────────────────
    app.get('/api/admin/finetune/datasets/:id/samples', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { status, limit, offset } = req.query as Record<string, string>;
        const samples = await this.doctorData.getFineTuneSamples(req.params.id as string, {
          status,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
        });
        res.json({ samples });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/admin/finetune/datasets/:id/samples', requireAuth, requireAdmin, async (req, res) => {
      try {
        const sample = await this.doctorData.createFineTuneSample({
          ...req.body, dataset_id: req.params.id,
        });
        res.status(201).json(sample);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.patch('/api/admin/finetune/samples/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        const sample = await this.doctorData.updateFineTuneSample(
          req.params.id as string, { ...req.body, reviewed_by: req.user!.id },
        );
        res.json(sample);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Fine-Tune Jobs ────────────────────────────────────
    app.get('/api/admin/finetune/jobs', requireAuth, requireAdmin, async (req, res) => {
      try {
        const datasetId = req.query.dataset_id as string | undefined;
        const jobs = await this.doctorData.getFineTuneJobs(datasetId);
        res.json({ jobs });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/admin/finetune/jobs', requireAuth, requireAdmin, async (req, res) => {
      try {
        const job = await this.doctorData.createFineTuneJob(req.body);
        res.status(201).json(job);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.patch('/api/admin/finetune/jobs/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        const job = await this.doctorData.updateFineTuneJob(req.params.id as string, req.body);
        res.json(job);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Auto-generate samples from learning entries ───────
    app.post('/api/admin/finetune/datasets/:id/generate', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { doctor_id, types, min_confidence } = req.body;
        const count = await this.doctorData.generateSamplesFromLearning(
          req.params.id as string, { doctor_id, types, min_confidence },
        );
        res.json({ generated: count });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Chat Analysis ─────────────────────────────────────
    app.get('/api/admin/doctors/:id/analysis', requireAuth, requireAdmin, async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const analysis = await this.doctorData.getDoctorChatAnalysis(req.params.id as string, days);
        res.json(analysis);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Doctor's own analysis
    app.get('/api/doctor/analysis', requireAuth, async (req, res) => {
      try {
        const profile = await this.doctorData.getDoctorProfileByUserId(req.user!.id);
        if (!profile) { res.status(404).json({ error: 'No doctor profile' }); return; }
        const days = parseInt(req.query.days as string) || 30;
        const analysis = await this.doctorData.getDoctorChatAnalysis(profile.id, days);
        res.json(analysis);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Extract learning from conversation (trigger) ──────
    app.post('/api/admin/learning/extract', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { doctorId, conversationId, messages } = req.body;
        const entries = await this.doctorData.extractLearningFromConversation(
          doctorId, conversationId, messages,
        );
        res.json({ extracted: entries.length, entries });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });
  }

  // ─── Admin Routes ────────────────────────────────────────

  private registerAdminRoutes(
    app: express.Express,
    requireAuth: express.RequestHandler,
    requireAdmin: express.RequestHandler,
  ): void {
    // List all users
    app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
      try {
        const users = await this.auth.listUsers();
        res.json({ users });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Update user role
    app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { role } = req.body;
        if (!['admin', 'user'].includes(role)) {
          res.status(400).json({ error: 'Invalid role' });
          return;
        }
        await this.auth.updateUserRole(req.params.id as string, role);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Toggle user active status
    app.patch('/api/admin/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { isActive } = req.body;
        await this.auth.setUserActive(req.params.id as string, !!isActive);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Channel configs CRUD
    app.get('/api/admin/channels', requireAuth, requireAdmin, async (_req, res) => {
      try {
        const channels = await this.auth.listChannelConfigs();
        res.json({ channels });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/admin/channels', requireAuth, requireAdmin, async (req, res) => {
      try {
        const channel = await this.auth.upsertChannelConfig(req.body, req.user!.id);
        res.json(channel);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.delete('/api/admin/channels/:id', requireAuth, requireAdmin, async (req, res) => {
      try {
        await this.auth.deleteChannelConfig(req.params.id as string);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Start / stop a channel
    app.post('/api/admin/channels/:platform/start', requireAuth, requireAdmin, async (req, res) => {
      try {
        const platform = req.params.platform as string;
        const cfg = await this.auth.getChannelConfig(platform);
        if (!cfg) { res.status(404).json({ error: 'Channel config not found' }); return; }

        // For telegram, dynamically load and start
        if (cfg.platform === 'telegram' && cfg.config.botToken) {
          try {
            const mod = await import(/* webpackIgnore: true */ '@xclaw/channel-telegram' as string);
            const TelegramChannel = mod.TelegramChannel || mod.default;
            if (TelegramChannel) {
              const tg = new TelegramChannel(cfg.config.botToken as string);
              this.channels.register(tg);
              await tg.start();
            }
          } catch { /* telegram package not available */ }
        }
        await this.auth.updateChannelStatus(cfg.platform, 'connected');
        res.json({ success: true, status: 'connected' });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/admin/channels/:platform/stop', requireAuth, requireAdmin, async (req, res) => {
      try {
        const platform = req.params.platform as string;
        const channel = this.channels.getByPlatform(platform as any);
        if (channel) await channel.stop();
        await this.auth.updateChannelStatus(platform, 'disconnected');
        res.json({ success: true, status: 'disconnected' });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // API keys management (admin can see all, or scoped to a user)
    app.get('/api/admin/api-keys', requireAuth, requireAdmin, async (_req, res) => {
      try {
        const keys = await this.auth.listApiKeys();
        res.json({ keys });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // User manages own API keys
    app.get('/api/api-keys', requireAuth, async (req, res) => {
      try {
        const keys = await this.auth.listApiKeysForUser(req.user!.id);
        res.json({ keys });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.post('/api/api-keys', requireAuth, async (req, res) => {
      try {
        const { name } = req.body;
        const result = await this.auth.createApiKey(req.user!.id, name || 'Default');
        res.json(result);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.delete('/api/api-keys/:id', requireAuth, async (req, res) => {
      try {
        await this.auth.deleteApiKey(req.user!.id, req.params.id as string);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // Admin: promote first user to admin (bootstrap)
    app.post('/api/admin/bootstrap', requireAuth, async (req, res) => {
      try {
        const isFirst = await this.auth.isFirstUser(req.user!.id);
        if (!isFirst) { res.status(403).json({ error: 'Only the first registered user can bootstrap admin' }); return; }
        await this.auth.updateUserRole(req.user!.id, 'admin');
        res.json({ success: true, role: 'admin' });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    // ── Reports & Analytics ─────────────────────────────
    app.get('/api/admin/reports/summary', requireAuth, requireAdmin, async (req, res) => {
      try {
        const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);
        const summary = await this.reports.getSummary(days);
        res.json(summary);
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/admin/reports/user-activity', requireAuth, requireAdmin, async (req, res) => {
      try {
        const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
        const users = await this.reports.getUserActivity(days);
        res.json({ users });
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    app.get('/api/admin/reports/export', requireAuth, requireAdmin, async (req, res) => {
      try {
        const type = (req.query.type as string) || 'summary';
        const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);
        const format = (req.query.format as string) || 'markdown';

        if (format === 'excel') {
          const buffer = await this.reports.generateExcel(type, days);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="report-${type}-${days}d.xlsx"`);
          res.send(buffer);
        } else if (format === 'pdf') {
          const buffer = await this.reports.generatePdf(type, days);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="report-${type}-${days}d.pdf"`);
          res.send(buffer);
        } else {
          const text = await this.reports.generateTextReport(type, days);
          res.type('text/markdown').send(text);
        }
      } catch (err) { res.status(500).json({ error: String(err) }); }
    });
  }

  // ─── Embeddable Widget Routes ────────────────────────────

  private registerEmbedRoutes(
    app: express.Express,
    _requireAuth: express.RequestHandler,
    requireApiKey: express.RequestHandler,
  ): void {
    // Widget chat endpoint (uses API key auth)
    app.post('/api/embed/chat', requireApiKey, async (req, res) => {
      const { message, sessionId } = req.body;
      if (!message) { res.status(400).json({ error: 'message is required' }); return; }
      try {
        const chatSessionId = sessionId || `embed_${req.user!.id}_${Date.now()}`;
        const response = await this.agent.chat(chatSessionId, message);
        res.json({ sessionId: chatSessionId, response });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
      }
    });

    // Streaming embed chat
    app.post('/api/embed/chat/stream', requireApiKey, async (req, res) => {
      const { message, sessionId } = req.body;
      if (!message) { res.status(400).json({ error: 'message is required' }); return; }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        const chatSessionId = sessionId || `embed_${req.user!.id}_${Date.now()}`;
        let fullContent = '';

        for await (const chunk of this.agent.chatStream(chatSessionId, message)) {
          if (chunk.type === 'delta') {
            fullContent += chunk.content;
            res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk.content })}\n\n`);
          } else if (chunk.type === 'done') {
            res.write(`data: ${JSON.stringify({ type: 'done', sessionId: chatSessionId })}\n\n`);
          }
        }
      } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: err instanceof Error ? err.message : 'Unknown error' })}\n\n`);
      } finally {
        res.end();
      }
    });

    // Widget config endpoint (returns agent name, persona, allowed features)
    app.get('/api/embed/config', requireApiKey, (_req, res) => {
      const config = this.agent.getConfig();
      res.json({
        name: config.name,
        persona: config.persona,
      });
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
