// ============================================================
// API Client - REST + Gateway WebSocket
// ============================================================

import { uuid } from './uuid.js';
import { getAuthHeaders } from '../stores/auth-store.js';

const BASE = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Chat (requires conversationId now)
  chat: (conversationId: string, message: string) =>
    request<{ conversationId: string; response: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message }),
    }),

  // Streaming chat - returns a ReadableStream of SSE events
  chatStream: async (conversationId: string, message: string, webSearch: boolean = false): Promise<ReadableStreamDefaultReader<Uint8Array>> => {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ conversationId, message, webSearch }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.body!.getReader();
  },

  // Web search
  webSearch: (query: string) =>
    request<{ results: string }>('/api/web-search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  // Conversations
  getConversations: () =>
    request<{ conversations: any[] }>('/api/conversations'),
  createConversation: (title?: string) =>
    request<any>('/api/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) =>
    request('/api/conversations/' + id, { method: 'DELETE' }),
  renameConversation: (id: string, title: string) =>
    request('/api/conversations/' + id, { method: 'PATCH', body: JSON.stringify({ title }) }),
  getMessages: (conversationId: string) =>
    request<{ messages: any[] }>('/api/conversations/' + conversationId + '/messages'),

  // Skills
  getSkills: () => request<{ skills: any[] }>('/api/skills'),
  getActiveSkills: () => request<{ skills: any[] }>('/api/skills/active'),
  activateSkill: (id: string, config?: Record<string, unknown>) =>
    request('/api/skills/' + id + '/activate', { method: 'POST', body: JSON.stringify({ config }) }),
  deactivateSkill: (id: string) =>
    request('/api/skills/' + id + '/deactivate', { method: 'POST' }),

  // Tools
  getTools: () => request<{ tools: any[] }>('/api/tools'),

  // Workflows
  getWorkflows: () => request<{ workflows: any[] }>('/api/workflows'),
  getWorkflow: (id: string) => request<any>('/api/workflows/' + id),
  saveWorkflow: (workflow: any) =>
    request<any>(workflow.id ? `/api/workflows/${workflow.id}` : '/api/workflows', {
      method: workflow.id ? 'PUT' : 'POST',
      body: JSON.stringify(workflow),
    }),
  deleteWorkflow: (id: string) =>
    request('/api/workflows/' + id, { method: 'DELETE' }),
  executeWorkflow: (id: string, triggerData?: Record<string, unknown>) =>
    request<any>('/api/workflows/' + id + '/execute', {
      method: 'POST',
      body: JSON.stringify({ triggerData }),
    }),

  // Agent
  getConfig: () => request<any>('/api/agent/config'),
  updateConfig: (config: any) =>
    request('/api/agent/config', { method: 'PATCH', body: JSON.stringify(config) }),

  // Memory
  searchMemory: (query: string, limit?: number) =>
    request<{ results: any[] }>('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  // Gateway info
  getGatewaySessions: () => request<{ sessions: any[] }>('/api/gateway/sessions'),
  getGatewayChannels: () => request<{ channels: any[] }>('/api/gateway/channels'),

  // Knowledge Base (RAG)
  getKBCollections: () => request<any>('/api/kb/collections'),
  createKBCollection: (data: { name: string; description?: string; chunk_strategy?: string; max_tokens?: number; overlap?: number; tags?: string[] }) =>
    request<any>('/api/kb/collections', { method: 'POST', body: JSON.stringify(data) }),
  deleteKBCollection: (id: string) =>
    request<any>('/api/kb/collections/' + id, { method: 'DELETE' }),
  getKBDocuments: (collectionId: string) =>
    request<any>('/api/kb/collections/' + collectionId + '/documents'),
  addKBDocument: (collectionId: string, data: { source: string; input: string; name?: string }) =>
    request<any>('/api/kb/collections/' + collectionId + '/documents', { method: 'POST', body: JSON.stringify(data) }),
  deleteKBDocument: (collectionId: string, docId: string) =>
    request<any>('/api/kb/collections/' + collectionId + '/documents/' + docId, { method: 'DELETE' }),
  searchKB: (query: string, collectionIds?: string[], topK?: number) =>
    request<any>('/api/kb/search', { method: 'POST', body: JSON.stringify({ query, collection_ids: collectionIds, top_k: topK }) }),

  // Resources
  getResourceOverview: () => request<any>('/api/resources/overview'),
  getProviderHealth: () => request<any>('/api/provider/health'),
  getModels: () => request<any>('/api/models'),
  getOllamaModels: () => request<any>('/api/ollama/models'),
};

// ─── Gateway WebSocket Client ───────────────────────────────

type GatewayMessageHandler = (msg: any) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<GatewayMessageHandler>> = new Map();
  private pendingRequests: Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }> = new Map();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private _connected = false;

  constructor(private url: string = `ws://${location.host}/ws`) {}

  get connected(): boolean {
    return this._connected;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this._connected = true;
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // Handle ping/pong
      if (msg.type === 'ping') {
        this.send({ type: 'pong', id: msg.id, payload: {} });
        return;
      }

      // Resolve pending request/response
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.type === 'error') {
          pending.reject(new Error(msg.payload.error));
        } else {
          pending.resolve(msg);
        }
      }

      // Notify type-based handlers
      this.emit(msg.type, msg);
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.emit('disconnected', {});
      // Auto-reconnect after 3s
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this._connected = false;
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  /** Subscribe to a message type */
  on(type: string, handler: GatewayMessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  /** Send a message through the Gateway WS */
  send(msg: { type: string; id?: string; payload: any; sessionId?: string }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      ...msg,
      id: msg.id ?? uuid(),
      timestamp: new Date().toISOString(),
    }));
  }

  /** Send a request and wait for the response */
  request(msg: { type: string; payload: any; sessionId?: string }): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = uuid();
      this.pendingRequests.set(id, { resolve, reject });
      this.send({ ...msg, id });
      // Timeout after 60s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Gateway request timeout'));
        }
      }, 60_000);
    });
  }

  /** Chat via Gateway WS */
  async chat(sessionId: string, message: string): Promise<string> {
    const response = await this.request({
      type: 'chat',
      payload: { message, chatSessionId: sessionId },
    });
    return response.payload.content;
  }

  private emit(type: string, data: any): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const h of handlers) h(data);
    }
    // Also notify wildcard listeners
    const wildcards = this.handlers.get('*');
    if (wildcards) {
      for (const h of wildcards) h(data);
    }
  }
}

// Singleton gateway client
export const gatewayClient = new GatewayClient();
