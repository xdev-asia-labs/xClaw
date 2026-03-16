// ============================================================
// Model Management Types
// ============================================================

export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'custom';
export type ModelStatus = 'available' | 'unavailable' | 'error' | 'pulling';
export type HealthStatus = 'healthy' | 'degraded' | 'unreachable' | 'unknown';
export type MCPDomain = 'code' | 'web' | 'data' | 'productivity' | 'knowledge' | 'devops' | 'media' | 'custom';
export type MCPTransport = 'stdio' | 'sse' | 'streamable-http';
export type MCPServerStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'disabled';
export type ChunkStrategy = 'recursive' | 'sentence' | 'paragraph' | 'fixed';
export type DocumentSource = 'file' | 'text' | 'url';
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';

// ── Model Profiles ──────────────────────────────────────────

export interface ModelProfile {
  id: string;
  name: string;
  provider: LLMProvider;
  modelId: string;
  baseUrl?: string;
  hasApiKey: boolean;
  temperature: number;
  maxTokens: number;
  topP: number;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsEmbedding: boolean;
  status: ModelStatus;
  isDefault: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelInput {
  name: string;
  provider: LLMProvider;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  parameters?: { temperature?: number; maxTokens?: number; topP?: number };
  capabilities?: { toolCalling?: boolean; vision?: boolean; embedding?: boolean };
  isDefault?: boolean;
}

export interface UpdateModelInput {
  id: string;
  name?: string;
  baseUrl?: string;
  parameters?: { temperature?: number; maxTokens?: number; topP?: number };
  capabilities?: { toolCalling?: boolean; vision?: boolean; embedding?: boolean };
  tags?: string[];
  notes?: string;
}

// ── Benchmark ───────────────────────────────────────────────

export type BenchmarkTestType = 'speed' | 'code' | 'tool_calling' | 'vietnamese' | 'context_length' | 'full';

export interface BenchmarkResult {
  id: string;
  modelProfileId: string;
  testType: BenchmarkTestType;
  results: Record<string, unknown>;
  tokensPerSecond?: number;
  firstTokenMs?: number;
  qualityScore?: number;
  toolCallingAccuracy?: number;
  durationMs?: number;
  hardwareInfo?: Record<string, unknown>;
  createdAt: string;
}

// ── Usage ───────────────────────────────────────────────────

export interface UsageRecord {
  id: string;
  modelProfileId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  requestType: 'chat' | 'completion' | 'embedding' | 'tool_call';
  latencyMs?: number;
  sessionId?: string;
  createdAt: string;
}

// ── MCP Server ──────────────────────────────────────────────

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  domain: MCPDomain;
  transport: MCPTransport;
  command?: string;
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  autoConnect: boolean;
  status: MCPServerStatus;
  lastError?: string;
  presetName?: string;
  toolCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolRecord {
  id: string;
  serverId: string;
  toolName: string;
  bridgedName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  invocationCount: number;
  discoveredAt: string;
}

export interface MCPHealthStatus {
  status: MCPServerStatus;
  latencyMs?: number;
  toolCount?: number;
  error?: string;
}

export interface MCPPreset {
  name: string;
  domain: MCPDomain;
  transport: MCPTransport;
  command?: string;
  url?: string;
  envTemplate?: Record<string, string>;
  description: string;
}

// ── Knowledge Base / RAG ────────────────────────────────────

export interface KBCollection {
  collectionId: string;
  name: string;
  description?: string;
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  totalSizeBytes: number;
  embeddingModel: string;
  embeddingDimensions: number;
  chunkConfig: { strategy: ChunkStrategy; maxTokens: number; overlap: number };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KBDocument {
  documentId: string;
  collectionId: string;
  name: string;
  source: DocumentSource;
  mimeType: string;
  originalUrl?: string;
  contentHash: string;
  sizeBytes: number;
  status: DocumentStatus;
  chunkCount: number;
  error?: string;
  createdAt: string;
}

export interface KBChunk {
  chunkId: string;
  documentId: string;
  collectionId: string;
  content: string;
  index: number;
  tokenCount: number;
  embedding: number[];
  embeddingModel: string;
  startOffset: number;
  endOffset: number;
  createdAt: string;
}

export interface RAGConfig {
  id: string;
  collectionId: string;
  chunkStrategy: ChunkStrategy;
  chunkMaxTokens: number;
  chunkOverlap: number;
  embeddingModel: string;
  embeddingProvider: 'ollama' | 'openai';
  embeddingDimensions: number;
  searchTopK: number;
  scoreThreshold: number;
  autoInject: boolean;
}

export interface RAGSearchResult {
  content: string;
  documentId: string;
  collectionId: string;
  chunkIndex: number;
  score: number;
}

export interface Embedding {
  vector: number[];
  dimensions: number;
  model: string;
}

// ── Audit ───────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'switch' | 'activate' | 'deactivate';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  performedBy: string;
  sessionId?: string;
  createdAt: string;
}

// ── Conversation (MongoDB) ──────────────────────────────────

export interface ConversationDoc {
  conversationId: string;
  title?: string;
  modelProfileId?: string;
  modelName?: string;
  provider?: string;
  messages: ConversationMessageDoc[];
  messageCount: number;
  totalTokens: number;
  tags: string[];
  createdAt: Date;
  lastMessageAt: Date;
  deletedAt?: Date;
}

export interface ConversationMessageDoc {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  usage?: { promptTokens: number; completionTokens: number };
  timestamp: Date;
}

// ── Skill config passed on activation ───────────────────────

export interface ModelManagementConfig {
  pgConnectionString: string;
  mongoConnectionString: string;
  encryptionKey: string;
  ollamaBaseUrl: string;
}
