// ============================================================
// xClaw Shared Types - Foundation for the entire platform
// ============================================================

// ─── LLM Provider Types ─────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'google' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

// ─── Tool System Types ──────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  returns: ToolParameter;
  requiresApproval?: boolean;
  timeout?: number;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result: unknown;
  error?: string;
  duration: number;
}

// ─── Skill / Plugin Types ───────────────────────────────────

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: SkillCategory;
  tags: string[];
  tools: ToolDefinition[];
  triggers?: TriggerDefinition[];
  config?: SkillConfigField[];
  dependencies?: string[];
}

export type SkillCategory =
  | 'programming'
  | 'healthcare'
  | 'productivity'
  | 'marketing'
  | 'finance'
  | 'ecommerce'
  | 'smart-home'
  | 'communication'
  | 'analytics'
  | 'devops'
  | 'content'
  | 'research'
  | 'sales'
  | 'project-management'
  | 'learning'
  | 'design'
  | 'custom';

export interface SkillConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret';
  description: string;
  required?: boolean;
  default?: unknown;
  options?: { label: string; value: string }[];
}

// ─── Trigger System ─────────────────────────────────────────

export interface TriggerDefinition {
  id: string;
  type: TriggerType;
  name: string;
  description: string;
  config: Record<string, unknown>;
}

export type TriggerType =
  | 'cron'       // Scheduled: "every day at 9am"
  | 'webhook'    // HTTP webhook incoming
  | 'event'      // Internal event bus
  | 'message'    // Chat message pattern match
  | 'file'       // File system change
  | 'manual';    // User-triggered

// ─── Workflow Types (Drag & Drop) ───────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  trigger: TriggerDefinition;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
  inputs: NodePort[];
  outputs: NodePort[];
}

export type WorkflowNodeType =
  | 'trigger'       // Start node
  | 'llm-call'      // Call LLM
  | 'tool-call'     // Execute a tool
  | 'condition'     // If/else branch
  | 'loop'          // For/while loop
  | 'transform'     // Data transformation (JS/template)
  | 'http-request'  // HTTP call
  | 'code'          // Custom code execution
  | 'memory-read'   // Read from memory
  | 'memory-write'  // Write to memory
  | 'notification'  // Send notification
  | 'wait'          // Delay/wait
  | 'switch'        // Multi-branch switch
  | 'merge'         // Merge branches
  | 'sub-workflow'  // Call another workflow
  | 'output';       // End node with output

export interface WorkflowNodeData {
  label: string;
  description?: string;
  config: Record<string, unknown>;
  // Visual customization
  color?: string;
  icon?: string;
}

export interface NodePort {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
}

export interface WorkflowEdge {
  id: string;
  source: string;      // node id
  sourcePort: string;   // port id
  target: string;       // node id
  targetPort: string;   // port id
  condition?: string;   // for conditional edges
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: unknown;
  description?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  nodeResults: Map<string, NodeExecutionResult>;
  variables: Record<string, unknown>;
  error?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  duration: number;
}

// ─── Memory Types ───────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  type: 'fact' | 'preference' | 'conversation' | 'context' | 'skill-data';
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  source: string;
  tags: string[];
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── Messaging / Chat Types ─────────────────────────────────

export type ChatPlatform = 'web' | 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'api';

export interface IncomingMessage {
  platform: ChatPlatform;
  channelId: string;
  userId: string;
  content: string;
  attachments?: Attachment[];
  replyTo?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface OutgoingMessage {
  platform: ChatPlatform;
  channelId: string;
  content: string;
  attachments?: Attachment[];
  replyTo?: string;
}

export interface Attachment {
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

// ─── Agent Config ───────────────────────────────────────────

export interface AgentConfig {
  id: string;
  name: string;
  persona: string;
  systemPrompt: string;
  llm: LLMConfig;
  enabledSkills: string[];
  enabledWorkflows: string[];
  memory: {
    enabled: boolean;
    maxEntries: number;
    embeddingModel?: string;
  };
  security: {
    requireApprovalForShell: boolean;
    requireApprovalForNetwork: boolean;
    sandboxed: boolean;
    allowedDomains?: string[];
    blockedCommands?: string[];
  };
  messaging: {
    platforms: ChatPlatform[];
    maxConcurrentSessions: number;
  };
}

// ─── Event Bus ──────────────────────────────────────────────

export interface AgentEvent {
  type: string;
  payload: Record<string, unknown>;
  source: string;
  timestamp: string;
}

export type EventHandler = (event: AgentEvent) => Promise<void>;

// ─── Gateway Types (WS Control Plane) ───────────────────────

export interface GatewayConfig {
  port: number;
  host: string;
  heartbeatInterval: number;    // ms
  sessionTimeout: number;       // ms
  maxSessionsPerUser: number;
  corsOrigins: string[];
}

export interface GatewaySession {
  id: string;
  userId: string;
  platform: ChatPlatform;
  channelId: string;
  connectedAt: string;
  lastActiveAt: string;
  metadata: Record<string, unknown>;
}

export type GatewayMessageType =
  | 'auth'           // Client authenticates
  | 'chat'           // Chat message
  | 'chat:stream'    // Streaming chat chunk
  | 'chat:response'  // Full chat response
  | 'tool:call'      // Tool execution request
  | 'tool:result'    // Tool execution result
  | 'tool:approval'  // Tool approval request/response
  | 'workflow:execute' // Start a workflow
  | 'workflow:status'  // Workflow status update
  | 'workflow:result'  // Workflow completion
  | 'skill:list'     // List skills
  | 'skill:toggle'   // Activate/deactivate skill
  | 'event'          // Generic event forwarding
  | 'ping'           // Heartbeat ping
  | 'pong'           // Heartbeat pong
  | 'error';         // Error message

export interface GatewayMessage {
  type: GatewayMessageType;
  id: string;           // Message ID for request/response correlation
  sessionId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ─── Channel Plugin Types ───────────────────────────────────

export interface ChannelPlugin {
  id: string;
  platform: ChatPlatform;
  name: string;
  version: string;
  description: string;

  initialize(config: Record<string, unknown>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  /** Send a message through this channel */
  send(message: OutgoingMessage): Promise<void>;

  /** Register handler for incoming messages */
  onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
}

// ─── Plugin Manifest (npm distribution) ─────────────────────

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  category?: SkillCategory;
  entry: string;          // Main entry file
  config?: SkillConfigField[];
  dependencies?: string[];
  platforms?: ChatPlatform[];     // For channel plugins
  permissions?: PluginPermission[];
}

export type PluginType = 'skill' | 'channel' | 'integration' | 'theme' | 'knowledge-pack';

// ─── Knowledge Pack (plugin-based data packs) ──────────────

/** Descriptor for a data collection inside a knowledge pack */
export interface KnowledgeDataSource {
  /** Unique ID for this data source */
  id: string;
  /** Human-readable label */
  label: string;
  /** Relative path to the JSON data file from the pack root */
  file: string;
  /** What kind of data: drugs, interactions, contraindications, allergies, etc. */
  kind: 'drug-formulary' | 'drug-interactions' | 'icd10-contraindications' | 'cross-reactivity' | 'allergy-profiles' | 'custom';
  /** Description shown in UI */
  description?: string;
}

/** Manifest for knowledge-pack type plugins (xclaw.plugin.json) */
export interface KnowledgePackManifest extends PluginManifest {
  type: 'knowledge-pack';
  /** Domain this pack belongs to */
  domain: 'healthcare' | 'programming' | 'general';
  /** Standard the data conforms to (e.g. 'HL7-FHIR-R5', 'ICD-10', 'RxNorm') */
  standard?: string;
  /** Locale / region */
  locale?: string;
  /** Data sources bundled in this pack */
  dataSources: KnowledgeDataSource[];
}

export type PluginPermission =
  | 'network'        // HTTP requests
  | 'filesystem'     // File read/write
  | 'shell'          // Shell command execution
  | 'memory'         // Memory access
  | 'llm'            // LLM API calls
  | 'secrets';       // Access to secrets/API keys

// ─── SkillHub Types (Marketplace) ───────────────────────────

export type SkillSource = 'built-in' | 'anthropic' | 'community' | 'npm' | 'mcp' | 'partner';

export interface HubAuthor {
  name: string;
  email?: string;
  url?: string;
  avatar?: string;
  verified: boolean;
}

export interface HubSkillStats {
  installs: number;
  activeInstalls: number;
  rating: number;
  reviewCount: number;
  weeklyDownloads: number;
}

export interface HubDistribution {
  type: 'registry' | 'npm' | 'git' | 'file';
  url?: string;
  checksum?: string;
  size?: number;
  tarball?: string;
}

export interface HubSkillEntry {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  longDescription?: string;
  author: HubAuthor;
  license: string;
  category: SkillCategory;
  tags: string[];
  source: SkillSource;
  manifest: SkillManifest;
  readme?: string;
  changelog?: string;
  skillMd?: string;
  stats: HubSkillStats;
  distribution: HubDistribution;
  compatible: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface SkillReview {
  id: string;
  skillId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  helpful: number;
}

export type SubmissionStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'needs-changes';

export interface SkillSubmission {
  id: string;
  skillId: string;
  version: string;
  submittedBy: HubAuthor;
  status: SubmissionStatus;
  reviewNotes?: string;
  securityScanResult?: SecurityScanResult;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface SecurityScanResult {
  passed: boolean;
  score: number;
  issues: SecurityIssue[];
}

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  message: string;
  file?: string;
  line?: number;
}

/** Parsed Anthropic SKILL.md format */
export interface AnthropicSkill {
  name: string;
  description: string;
  allowedTools?: string[];
  instructions: string;
  examples?: string;
  sourceCommitSha?: string;
  sourceRepoUrl: string;
  folderPath: string;
}

export interface HubSearchParams {
  search?: string;
  category?: SkillCategory;
  source?: SkillSource;
  tags?: string[];
  author?: string;
  minRating?: number;
  sort?: 'featured' | 'popular' | 'recent' | 'rating' | 'name';
  page?: number;
  limit?: number;
}

export interface HubSearchResult {
  skills: HubSkillEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
