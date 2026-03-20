import { XClawClient } from '@xclaw-ai/chat-sdk';
import type { StreamEvent, ConversationSummary, ConversationDetailResponse } from '@xclaw-ai/chat-sdk';

const API_BASE = '';

let authToken: string | null = localStorage.getItem('xclaw_token');

// Shared XClawClient instance
const xclaw = new XClawClient({ baseUrl: API_BASE, token: authToken ?? undefined });

/** Access the shared XClawClient instance */
export function getXClawClient() { return xclaw; }

export function setToken(token: string) {
  authToken = token;
  localStorage.setItem('xclaw_token', token);
  xclaw.setToken(token);
}

export function clearToken() {
  authToken = null;
  localStorage.removeItem('xclaw_token');
}

export function getToken(): string | null {
  return authToken;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  // Only set Content-Type to JSON if not FormData
  if (init?.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

// ─── Auth ───────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function getMe() {
  const res = await apiFetch('/auth/me');
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

// ─── RBAC ───────────────────────────────────────────────────

export async function getRBACUsers() {
  const res = await apiFetch('/api/rbac/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function getRBACRoles() {
  const res = await apiFetch('/api/rbac/roles');
  if (!res.ok) throw new Error('Failed to fetch roles');
  return res.json();
}

export async function getRBACPermissions() {
  const res = await apiFetch('/api/rbac/permissions');
  if (!res.ok) throw new Error('Failed to fetch permissions');
  return res.json();
}

export async function inviteUser(email: string, name: string, role: string) {
  const res = await apiFetch('/auth/invite', {
    method: 'POST',
    body: JSON.stringify({ email, name, role }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to invite user');
  }
  return res.json();
}

export async function updateUserStatus(userId: string, status: string) {
  const res = await apiFetch(`/api/rbac/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function assignUserRole(userId: string, roleName: string) {
  const res = await apiFetch(`/api/rbac/users/${userId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ roleName }),
  });
  if (!res.ok) throw new Error('Failed to assign role');
  return res.json();
}

export async function removeUserRole(userId: string, roleName: string) {
  const res = await apiFetch(`/api/rbac/users/${userId}/roles/${roleName}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove role');
  return res.json();
}

export async function createRole(name: string, description: string, permissionIds: string[]) {
  const res = await apiFetch('/api/rbac/roles', {
    method: 'POST',
    body: JSON.stringify({ name, displayName: name.charAt(0).toUpperCase() + name.slice(1), description, permissionIds }),
  });
  if (!res.ok) throw new Error('Failed to create role');
  return res.json();
}

export async function deleteRole(roleId: string) {
  const res = await apiFetch(`/api/rbac/roles/${roleId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete role');
  return res.json();
}

// ─── Health ─────────────────────────────────────────────────

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

// ─── Chat (via @xclaw-ai/chat-sdk) ──────────────────────────

export async function sendChat(message: string, sessionId: string, domainId?: string) {
  return xclaw.chat(message, { sessionId, domainId });
}

export async function* streamChat(message: string, sessionId: string, webSearch = false, domainId?: string): AsyncGenerator<StreamEvent> {
  const events: StreamEvent[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  xclaw.chatStream(message, {
    onTextDelta: (delta) => {
      events.push({ type: 'text-delta', delta });
      resolve?.();
    },
    onMeta: (key, data) => {
      events.push({ type: 'meta', key, data });
      resolve?.();
    },
    onFinish: (usage, finishReason) => {
      events.push({ type: 'finish', usage, finishReason });
      done = true;
      resolve?.();
    },
    onError: (error) => {
      events.push({ type: 'error', error });
      done = true;
      resolve?.();
    },
    onToolCallStart: (toolCallId, toolName) => {
      events.push({ type: 'tool-call-start', toolCallId, toolName });
      resolve?.();
    },
    onToolCallArgs: (toolCallId, argsJson) => {
      events.push({ type: 'tool-call-args', toolCallId, argsJson });
      resolve?.();
    },
    onToolCallEnd: (toolCallId) => {
      events.push({ type: 'tool-call-end', toolCallId });
      resolve?.();
    },
    onToolResult: (toolCallId, result) => {
      events.push({ type: 'tool-result', toolCallId, result });
      resolve?.();
    },
  }, { sessionId, webSearch, domainId });

  while (!done || events.length > 0) {
    if (events.length > 0) {
      yield events.shift()!;
    } else if (!done) {
      await new Promise<void>(r => { resolve = r; });
    }
  }
}

export async function saveSearchToKnowledge(
  results: Array<{ title: string; url: string; snippet: string }>,
  query: string,
  collectionId?: string,
) {
  const res = await apiFetch('/api/chat/save-search', {
    method: 'POST',
    body: JSON.stringify({ results, query, collectionId }),
  });
  if (!res.ok) throw new Error('Failed to save search results');
  return res.json();
}

export async function submitChatFeedback(
  originalQuestion: string,
  aiAnswer: string,
  feedback: 'positive' | 'negative',
  correction?: string,
) {
  return xclaw.feedback({ originalQuestion, aiAnswer, feedback, correction });
}

// ─── Conversation History (via @xclaw-ai/chat-sdk) ──────────

export async function getConversations(): Promise<ConversationSummary[]> {
  return xclaw.listSessions();
}

export async function getConversation(id: string): Promise<ConversationDetailResponse> {
  return xclaw.getConversation(id);
}

export async function renameConversation(id: string, title: string) {
  return xclaw.renameSession(id, title);
}

export async function deleteConversation(id: string) {
  return xclaw.deleteSession(id);
}

export async function saveChatMessage(sessionId: string, content: string) {
  return xclaw.saveMessage(sessionId, content);
}

// ─── Image Generation ───────────────────────────────────────

export async function generateImage(
  prompt: string,
  sessionId: string,
  options?: { width?: number; height?: number },
): Promise<{ imageUrl: string; prompt: string; width: number; height: number; seed: number }> {
  const res = await apiFetch('/api/chat/generate-image', {
    method: 'POST',
    body: JSON.stringify({ prompt, sessionId, ...options }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Image generation failed' }));
    throw new Error(err.error || 'Image generation failed');
  }
  return res.json();
}

// ─── Knowledge Base (RAG) ───────────────────────────────────

// Collections
export async function getCollections() {
  const res = await apiFetch('/api/knowledge/collections');
  if (!res.ok) throw new Error('Failed to fetch collections');
  return res.json();
}

export async function createCollection(name: string, description?: string, color?: string) {
  const res = await apiFetch('/api/knowledge/collections', {
    method: 'POST',
    body: JSON.stringify({ name, description, color }),
  });
  if (!res.ok) throw new Error('Failed to create collection');
  return res.json();
}

export async function updateCollection(id: string, updates: { name?: string; description?: string; color?: string }) {
  const res = await apiFetch(`/api/knowledge/collections/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update collection');
  return res.json();
}

export async function deleteCollection(id: string) {
  const res = await apiFetch(`/api/knowledge/collections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete collection');
  return res.json();
}

// Document List & Stats
export async function getKnowledge(filters?: {
  collectionId?: string;
  tag?: string;
  source?: string;
  enabled?: boolean;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.collectionId) params.set('collectionId', filters.collectionId);
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.source) params.set('source', filters.source);
  if (filters?.enabled !== undefined) params.set('enabled', String(filters.enabled));
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();
  const res = await apiFetch(`/api/knowledge${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch knowledge base');
  return res.json();
}

export async function getTags() {
  const res = await apiFetch('/api/knowledge/tags');
  if (!res.ok) throw new Error('Failed to fetch tags');
  return res.json();
}

export async function getAnalytics() {
  const res = await apiFetch('/api/knowledge/analytics');
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function getQueryHistory(limit?: number) {
  const qs = limit ? `?limit=${limit}` : '';
  const res = await apiFetch(`/api/knowledge/query-history${qs}`);
  if (!res.ok) throw new Error('Failed to fetch query history');
  return res.json();
}

// Upload
export async function uploadDocument(text: string, title: string, options?: {
  source?: string;
  tags?: string[];
  collectionId?: string;
  customMetadata?: Record<string, string>;
  chunkSize?: number;
  chunkOverlap?: number;
}) {
  const res = await apiFetch('/api/knowledge/upload', {
    method: 'POST',
    body: JSON.stringify({
      text,
      title,
      source: options?.source || 'upload',
      ...options,
    }),
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function uploadDocumentFile(file: File, options?: {
  title?: string;
  tags?: string[];
  collectionId?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}) {
  const form = new FormData();
  form.append('file', file);
  if (options?.title) form.append('title', options.title);
  form.append('source', 'file-upload');
  if (options?.tags?.length) form.append('tags', options.tags.join(','));
  if (options?.collectionId) form.append('collectionId', options.collectionId);
  if (options?.chunkSize) form.append('chunkSize', String(options.chunkSize));
  if (options?.chunkOverlap) form.append('chunkOverlap', String(options.chunkOverlap));

  const res = await apiFetch('/api/knowledge/upload', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function importUrl(url: string, options?: {
  title?: string;
  tags?: string[];
  collectionId?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}) {
  const res = await apiFetch('/api/knowledge/import-url', {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
  });
  if (!res.ok) throw new Error('Import failed');
  return res.json();
}

// Search
export async function searchKnowledge(query: string, topK?: number, collectionId?: string) {
  const res = await apiFetch('/api/knowledge/search', {
    method: 'POST',
    body: JSON.stringify({ query, topK, collectionId }),
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

// Document CRUD
export async function getDocument(id: string) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Document not found');
  return res.json();
}

export async function updateDocument(id: string, updates: {
  title?: string;
  tags?: string[];
  collectionId?: string;
  customMetadata?: Record<string, string>;
}) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

export async function deleteDocument(id: string) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export async function setDocumentEnabled(id: string, enabled: boolean) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(id)}/enabled`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

export async function reindexDocument(id: string, chunkSize?: number, chunkOverlap?: number) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(id)}/reindex`, {
    method: 'POST',
    body: JSON.stringify({ chunkSize, chunkOverlap }),
  });
  if (!res.ok) throw new Error('Reindex failed');
  return res.json();
}

// Chunks
export async function getDocumentChunks(id: string) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(id)}/chunks`);
  if (!res.ok) throw new Error('Failed to fetch chunks');
  return res.json();
}

export async function addChunk(documentId: string, content: string) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(documentId)}/chunks`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to add chunk');
  return res.json();
}

export async function updateChunk(documentId: string, chunkId: string, content: string) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(documentId)}/chunks/${encodeURIComponent(chunkId)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to update chunk');
  return res.json();
}

export async function deleteChunk(documentId: string, chunkId: string) {
  const res = await apiFetch(`/api/knowledge/${encodeURIComponent(documentId)}/chunks/${encodeURIComponent(chunkId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete chunk');
  return res.json();
}

// Batch Operations
export async function batchDeleteDocuments(documentIds: string[]) {
  const res = await apiFetch('/api/knowledge/batch/delete', {
    method: 'POST',
    body: JSON.stringify({ documentIds }),
  });
  if (!res.ok) throw new Error('Batch delete failed');
  return res.json();
}

export async function batchSetEnabled(documentIds: string[], enabled: boolean) {
  const res = await apiFetch('/api/knowledge/batch/enable', {
    method: 'POST',
    body: JSON.stringify({ documentIds, enabled }),
  });
  if (!res.ok) throw new Error('Batch enable failed');
  return res.json();
}

export async function batchReindex(documentIds: string[], chunkSize?: number, chunkOverlap?: number) {
  const res = await apiFetch('/api/knowledge/batch/reindex', {
    method: 'POST',
    body: JSON.stringify({ documentIds, chunkSize, chunkOverlap }),
  });
  if (!res.ok) throw new Error('Batch reindex failed');
  return res.json();
}

export async function batchMoveToCollection(documentIds: string[], collectionId: string) {
  const res = await apiFetch('/api/knowledge/batch/move', {
    method: 'POST',
    body: JSON.stringify({ documentIds, collectionId }),
  });
  if (!res.ok) throw new Error('Batch move failed');
  return res.json();
}

// ─── Models (Ollama) ────────────────────────────────────────

export async function getModels() {
  const res = await apiFetch('/api/models');
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function getModelsHealth() {
  const res = await apiFetch('/api/models/health');
  return res.json();
}

export async function setActiveModel(model: string) {
  const res = await apiFetch('/api/models/active', {
    method: 'PUT',
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error('Failed to set active model');
  return res.json();
}

export async function* pullModel(model: string) {
  const res = await apiFetch('/api/models/pull', {
    method: 'POST',
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error('Pull failed');

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try { yield JSON.parse(data); } catch { /* skip */ }
      }
    }
  }
}

export async function deleteModel(name: string) {
  const res = await apiFetch(`/api/models/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export async function getModelInfo(name: string) {
  const res = await apiFetch(`/api/models/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Model not found');
  return res.json();
}

// ─── File Attachments ───────────────────────────────────────

export async function uploadChatAttachment(file: File, _sessionId: string) {
  return xclaw.uploadFile(file, file.name);
}

// ─── Global Search ──────────────────────────────────────────

export async function globalSearch(query: string, options?: {
  sources?: ('knowledge' | 'chat')[];
  topK?: number;
  collectionId?: string;
}) {
  const res = await apiFetch('/api/search', {
    method: 'POST',
    body: JSON.stringify({ query, ...options }),
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

// ─── Medical ────────────────────────────────────────────────

export async function checkDrugInteraction(drugs: string[]) {
  const res = await apiFetch('/api/medical/drug-interaction', {
    method: 'POST',
    body: JSON.stringify({ drugs }),
  });
  if (!res.ok) throw new Error('Drug interaction check failed');
  return res.json();
}

export async function searchICD10(query: string, category?: string) {
  const res = await apiFetch('/api/medical/icd10', {
    method: 'POST',
    body: JSON.stringify({ query, category }),
  });
  if (!res.ok) throw new Error('ICD-10 search failed');
  return res.json();
}

export async function generateSOAPNote(data: {
  chiefComplaint: string;
  patientContext?: string;
  vitals?: string;
  examFindings?: string;
}) {
  const res = await apiFetch('/api/medical/soap-note', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('SOAP note generation failed');
  return res.json();
}

export async function checkClinicalAlert(text: string) {
  const res = await apiFetch('/api/medical/clinical-alert', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Clinical alert check failed');
  return res.json();
}

export async function getMedicalTemplates() {
  const res = await apiFetch('/api/medical/templates');
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

export async function getMedicalTemplate(id: string) {
  const res = await apiFetch(`/api/medical/templates/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Template not found');
  return res.json();
}

export async function fillMedicalTemplate(id: string, data: Record<string, string>) {
  const res = await apiFetch(`/api/medical/templates/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Fill template failed');
  return res.json();
}

export async function getICD10Categories() {
  const res = await apiFetch('/api/medical/icd10/categories');
  if (!res.ok) throw new Error('Failed to fetch ICD-10 categories');
  return res.json();
}

// ─── Domains ────────────────────────────────────────────────

export async function getDomains() {
  const res = await apiFetch('/api/domains');
  if (!res.ok) throw new Error('Failed to fetch domains');
  return res.json();
}

export async function getInstalledDomains() {
  const res = await apiFetch('/api/domains/installed');
  if (!res.ok) throw new Error('Failed to fetch installed domains');
  return res.json();
}

export async function installDomain(id: string) {
  const res = await apiFetch(`/api/domains/${encodeURIComponent(id)}/install`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to install domain');
  return res.json();
}

export async function uninstallDomain(id: string) {
  const res = await apiFetch(`/api/domains/${encodeURIComponent(id)}/uninstall`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to uninstall domain');
  return res.json();
}

export async function getDomain(id: string) {
  const res = await apiFetch(`/api/domains/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Domain not found');
  return res.json();
}

export async function getDomainPersona(id: string) {
  const res = await apiFetch(`/api/domains/${encodeURIComponent(id)}/persona`);
  if (!res.ok) throw new Error('Failed to fetch persona');
  return res.json();
}

export async function executeDomainTool(domainId: string, skillId: string, toolName: string, params: Record<string, unknown>) {
  const res = await apiFetch(`/api/domains/${encodeURIComponent(domainId)}/skills/${encodeURIComponent(skillId)}/tools/${encodeURIComponent(toolName)}/execute`, {
    method: 'POST',
    body: JSON.stringify({ params }),
  });
  if (!res.ok) throw new Error('Tool execution failed');
  return res.json();
}

// ─── Settings ───────────────────────────────────────────────

export async function getAISettings() {
  const res = await apiFetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateAISettings(settings: { aiLanguage?: string; aiLanguageCustom?: string }) {
  const res = await apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// ─── ML Engine ──────────────────────────────────────────────

export async function getMLAlgorithms() {
  const res = await apiFetch('/api/ml/algorithms');
  if (!res.ok) throw new Error('Failed to fetch algorithms');
  return res.json();
}

export async function trainMLModel(data: {
  algorithm: string;
  dataset: { features: number[][]; labels: (string | number)[]; featureNames?: string[] };
  hyperparameters?: Record<string, unknown>;
}) {
  const res = await apiFetch('/api/ml/train', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Training failed');
  return res.json();
}

export async function runAutoML(data: {
  dataset: { features: number[][]; labels: (string | number)[]; featureNames?: string[] };
  maxTrials?: number;
  taskType?: 'classification' | 'regression';
}) {
  const res = await apiFetch('/api/ml/automl', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('AutoML failed');
  return res.json();
}

export async function getMLModels() {
  const res = await apiFetch('/api/ml/models');
  if (!res.ok) throw new Error('Failed to fetch ML models');
  return res.json();
}

// ─── MCP Server Management ─────────────────────────────────

export async function getMCPServers() {
  const res = await apiFetch('/api/mcp/servers');
  if (!res.ok) throw new Error('Failed to fetch MCP servers');
  return res.json();
}

export async function getMCPServer(id: string) {
  const res = await apiFetch(`/api/mcp/servers/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Failed to fetch MCP server');
  return res.json();
}

export async function addMCPServer(config: {
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  description?: string;
}) {
  const res = await apiFetch('/api/mcp/servers', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to add MCP server');
  return res.json();
}

export async function toggleMCPServer(id: string) {
  const res = await apiFetch(`/api/mcp/servers/${encodeURIComponent(id)}/toggle`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error('Failed to toggle MCP server');
  return res.json();
}

export async function removeMCPServer(id: string) {
  const res = await apiFetch(`/api/mcp/servers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove MCP server');
  return res.json();
}

export async function getMCPTools() {
  const res = await apiFetch('/api/mcp/tools');
  if (!res.ok) throw new Error('Failed to fetch MCP tools');
  return res.json();
}

export async function callMCPTool(name: string, args: Record<string, unknown>) {
  const res = await apiFetch('/api/mcp/tools/call', {
    method: 'POST',
    body: JSON.stringify({ name, arguments: args }),
  });
  if (!res.ok) throw new Error('Failed to call MCP tool');
  return res.json();
}

export async function getMCPInfo() {
  const res = await apiFetch('/api/mcp/info');
  if (!res.ok) throw new Error('Failed to fetch MCP info');
  return res.json();
}

// ─── Plugins ──────────────────────────────────────────────────

export async function getPlugins() {
  const res = await apiFetch('/api/plugins');
  if (!res.ok) throw new Error('Failed to fetch plugins');
  return res.json();
}

export async function getPluginPages(): Promise<{
  ok: boolean;
  pages: Array<{
    pluginId: string;
    pluginName: string;
    pluginIcon: string;
    pages: Array<{
      path: string;
      title: string;
      icon: string;
      sidebar?: boolean;
      sidebarGroup?: string;
    }>;
  }>;
}> {
  const res = await apiFetch('/api/plugins/registry/pages');
  if (!res.ok) throw new Error('Failed to fetch plugin pages');
  return res.json();
}

// ─── ShirtGen Plugin ────────────────────────────────────────

export async function shirtgenGetDesigns(params?: { limit?: number; skip?: number; status?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.skip) q.set('skip', String(params.skip));
  if (params?.status) q.set('status', params.status);
  const res = await apiFetch(`/api/plugins/shirtgen/api/designs?${q}`);
  if (!res.ok) throw new Error('Failed to fetch designs');
  return res.json();
}

export async function shirtgenGetDesign(id: string) {
  const res = await apiFetch(`/api/plugins/shirtgen/api/designs/${id}`);
  if (!res.ok) throw new Error('Failed to fetch design');
  return res.json();
}

export async function shirtgenGenerate(prompt: string, options?: { style?: string; count?: number; width?: number; height?: number }) {
  const res = await apiFetch('/api/plugins/shirtgen/api/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, options }),
  });
  if (!res.ok) throw new Error('Generation failed');
  return res.json();
}

export async function shirtgenGetTrending() {
  const res = await apiFetch('/api/plugins/shirtgen/api/trending');
  if (!res.ok) throw new Error('Failed to fetch trending');
  return res.json();
}

export async function shirtgenGetImageModels() {
  const res = await apiFetch('/api/plugins/shirtgen/api/image-models');
  if (!res.ok) throw new Error('Failed to fetch image models');
  return res.json();
}

export async function shirtgenUpdateDesign(id: string, data: Record<string, unknown>) {
  const res = await apiFetch(`/api/plugins/shirtgen/api/designs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update design');
  return res.json();
}

// ─── Healthcare Plugin ──────────────────────────────────────

export async function healthcareGetPatients(params?: { limit?: number; skip?: number }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.skip) q.set('skip', String(params.skip));
  const res = await apiFetch(`/api/plugins/healthcare/api/patients?${q}`);
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json();
}

export async function healthcareGetClinicalNotes(patientId?: string) {
  const q = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
  const res = await apiFetch(`/api/plugins/healthcare/api/clinical-notes${q}`);
  if (!res.ok) throw new Error('Failed to fetch clinical notes');
  return res.json();
}

export async function healthcareCheckDrugInteraction(drugs: string[]) {
  const res = await apiFetch('/api/plugins/healthcare/api/drug-interaction', {
    method: 'POST',
    body: JSON.stringify({ drugs }),
  });
  if (!res.ok) throw new Error('Failed to check drug interactions');
  return res.json();
}

export async function healthcareLookupIcd10(query: string) {
  const res = await apiFetch('/api/plugins/healthcare/api/icd10', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Failed to lookup ICD-10');
  return res.json();
}

export async function healthcareGetIcd10Categories() {
  const res = await apiFetch('/api/plugins/healthcare/api/icd10/categories');
  if (!res.ok) throw new Error('Failed to fetch ICD-10 categories');
  return res.json();
}

export async function healthcareCheckClinicalAlert(text: string) {
  const res = await apiFetch('/api/plugins/healthcare/api/clinical-alert', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Failed to check clinical alerts');
  return res.json();
}

export async function healthcareGetTemplates() {
  const res = await apiFetch('/api/plugins/healthcare/api/templates');
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

export async function healthcareGetStats() {
  const res = await apiFetch('/api/plugins/healthcare/api/stats');
  if (!res.ok) throw new Error('Failed to fetch healthcare stats');
  return res.json();
}
