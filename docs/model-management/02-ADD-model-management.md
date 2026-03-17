# Architecture Design Document (ADD)
## xClaw Model Management Skill — Dual Database + MCP + RAG Architecture
**Version:** 3.0.0  
**Date:** 2026-03-16  
**Author:** xClaw Team  
**Status:** Draft  

---

## 1. Architecture Overview

### 1.1 Design Philosophy

Model Management được thiết kế theo 5 nguyên tắc:

1. **Skill-First** — Là một SkillPlugin, không phải core feature. Có thể enable/disable, config độc lập.
2. **Polyglot Persistence** — Dùng đúng database cho đúng loại data: PostgreSQL 18 cho structured, MongoDB cho unstructured.
3. **Tool-Oriented** — Mọi chức năng exposed qua SkillTools, Agent LLM có thể gọi bằng tool calling.
4. **MCP-Native** — Hỗ trợ Model Context Protocol để kết nối external tools theo chuyên đề. MCP servers là "domain tool packs".
5. **Knowledge-Augmented** — RAG pipeline tich́ hợp sâu: upload docs → chunk → embed → vector search → inject context vào mọi cuộc hội thoại.

### 1.2 High-Level Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │            xClaw Gateway (WS + REST)             │
                    │                ws://127.0.0.1:18789/ws           │
                    └─────────┬──────────────────────┬────────────────┘
                              │                      │
                    ┌─────────▼──────────┐ ┌────────▼─────────────┐
                    │   Agent Core       │ │     REST Router       │
                    │   (LLM Router)     │ │  /api/models/*        │
                    └─────────┬──────────┘ └────────┬─────────────┘
                              │                      │
                    ┌─────────▼──────────────────────▼─────────────┐
                    │         SkillManager                          │
                    │  ┌────────────────────────────────────────┐  │
                    │  │  Model Management Skill (SkillPlugin)  │  │
                    │  │                                        │  │
                    │  │  ┌──────────────────────────────────┐  │  │
                    │  │  │       Service Layer               │  │  │
                    │  │  │  ModelService  BenchmarkService   │  │  │
                    │  │  │  OllamaService UsageService       │  │  │
                    │  │  │  ConversationService              │  │  │
                    │  │  └──────────┬──────────┬─────────────┘  │  │
                    │  │             │          │                 │  │
                    │  │  ┌──────────▼───┐ ┌───▼──────────────┐  │  │
                    │  │  │ PostgreSQL18 │ │     MongoDB       │  │  │
                    │  │  │  Repository  │ │    Repository     │  │  │
                    │  │  └──────┬───────┘ └───┬──────────────┘  │  │
                    │  └─────────┼─────────────┼─────────────────┘  │
                    └────────────┼─────────────┼────────────────────┘
                                 │             │
                    ┌────────────▼──┐  ┌───────▼──────────────┐
                    │ PostgreSQL 18 │  │     MongoDB 7+        │
                    │ :5432         │  │     :27017             │
                    │               │  │                        │
                    │ Tables:       │  │ Collections:           │
                    │ model_profiles│  │ conversations          │
                    │ provider_cfg  │  │ memory_entries         │
                    │ usage_records │  │ llm_responses          │
                    │ benchmarks    │  │ prompt_templates       │
                    │ model_sessions│  │ knowledge_collections  │
                    │ mcp_servers   │  │ knowledge_documents    │
                    │ mcp_tools     │  │ knowledge_chunks       │
                    │ rag_configs   │  │ embeddings             │
                    │ audit_log     │  │ error_logs             │
                    └───────────────┘  └───────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Package Structure

```
packages/skills/src/model-management/
├── index.ts                    # defineSkill() — entry point
├── manifest.ts                 # SkillManifest definition
├── services/
│   ├── model.service.ts        # Model CRUD (PG18)
│   ├── ollama.service.ts       # Ollama API integration
│   ├── benchmark.service.ts    # Benchmark runner (PG18 results)
│   ├── usage.service.ts        # Token tracking (PG18)
│   ├── conversation.service.ts # Chat history (MongoDB)
│   ├── memory.service.ts       # Embeddings & RAG (MongoDB)
│   ├── health.service.ts       # Provider health checks
│   ├── mcp.service.ts          # MCP server lifecycle & tool discovery
│   ├── rag.service.ts          # RAG pipeline: chunk, embed, search
│   └── knowledge.service.ts    # Knowledge base CRUD (collections, docs)
├── repositories/
│   ├── pg/
│   │   ├── connection.ts       # PG18 pool (pg driver)
│   │   ├── migrations/
│   │   │   ├── 001_initial.sql
│   │   │   ├── 002_indexes.sql
│   │   │   └── 003_mcp_rag.sql     # MCP + RAG tables
│   │   ├── model.repo.ts       # model_profiles CRUD
│   │   ├── usage.repo.ts       # usage_records
│   │   ├── benchmark.repo.ts   # benchmark_results
│   │   ├── session.repo.ts     # model_sessions (temporal)
│   │   ├── mcp.repo.ts         # mcp_servers + mcp_tools
│   │   ├── rag.repo.ts         # rag_configs + rag_query_log
│   │   └── audit.repo.ts       # audit_log
│   └── mongo/
│       ├── connection.ts       # MongoDB client
│       ├── conversation.repo.ts
│       ├── memory.repo.ts
│       ├── response.repo.ts
│       ├── template.repo.ts
│       ├── knowledge.repo.ts   # knowledge_collections + documents + chunks
│       └── chunk.repo.ts       # chunk operations + vector search
├── tools/
│   ├── model-crud.tools.ts     # model_list, create, update, delete
│   ├── model-ops.tools.ts      # model_switch, get_active, benchmark, test
│   ├── ollama.tools.ts         # ollama_list, pull, remove
│   ├── health.tools.ts         # provider_health_check
│   ├── mcp.tools.ts            # mcp_register, mcp_list, mcp_toggle, mcp_health
│   └── knowledge.tools.ts      # kb_create_collection, kb_add_document, kb_search, kb_list, kb_delete
├── mcp/
│   ├── mcp-client.ts           # MCP protocol client (stdio/sse/http)
│   ├── mcp-registry.ts         # MCP server registry + tool injection
│   └── mcp-presets.ts          # Built-in MCP server presets by domain
├── rag/
│   ├── chunker.ts              # Text splitter (recursive, by tokens)
│   ├── embedder.ts             # Embed text using active/configured model
│   ├── vector-search.ts        # Cosine similarity search in MongoDB
│   └── document-parser.ts      # Parse PDF, MD, TXT, DOCX, HTML
├── crypto/
│   └── key-encryption.ts       # AES-256-GCM for API keys
└── types/
    └── index.ts                # Skill-specific TypeScript types
```

### 2.2 Layer Architecture

```
┌──────────────────────────────────────────────────┐
│  TOOL LAYER (tools/)                              │
│  - Exposed to Agent LLM via SkillContext          │
│  - Input validation & response formatting          │
│  - Maps to service methods                         │
├──────────────────────────────────────────────────┤
│  SERVICE LAYER (services/)                        │
│  - Business logic                                  │
│  - Orchestration between PG + Mongo               │
│  - Encryption/decryption of API keys               │
│  - Event emission via EventBus                     │
├──────────────────────────────────────────────────┤
│  REPOSITORY LAYER (repositories/)                 │
│  - Data access abstraction                         │
│  - PG: parameterized SQL queries                   │
│  - Mongo: collection operations                    │
│  - Connection pooling                              │
├──────────────────────────────────────────────────┤
│  DATA LAYER                                       │
│  - PostgreSQL 18 (:5432) — Structured/relational   │
│  - MongoDB 7+ (:27017) — Unstructured/documents    │
└──────────────────────────────────────────────────┘
```

---

## 3. Database Role Separation (Chi tiết)

### 3.1 PostgreSQL 18 — Structured Data

**Vai trò:** Lưu trữ dữ liệu có cấu trúc cố định, cần ACID, foreign keys, aggregation.

| Table | Purpose | PG18 Features Used |
|---|---|---|
| `model_profiles` | Cấu hình model (name, provider, params) | `uuidv7()` PK, virtual generated columns |
| `provider_configs` | Provider-level settings (API keys encrypted) | AES-256-GCM encrypted columns |
| `usage_records` | Token usage per request | Virtual generated column `cost_estimate` |
| `benchmark_results` | Benchmark scores | Multi-column B-tree with skip scan |
| `model_sessions` | Active model per session | Temporal constraints (WITHOUT OVERLAPS) |
| `mcp_servers` | MCP server configs by domain | `uuidv7()` PK, domain enum, transport config |
| `mcp_tools` | Cached tools discovered from MCP servers | FK to mcp_servers, tool schema JSONB |
| `rag_configs` | RAG pipeline settings per collection | FK to knowledge collections |
| `rag_query_log` | RAG search analytics | Query + chunks retrieved + feedback |
| `audit_log` | Change history | `OLD`/`NEW` RETURNING for triggers |

**Lý do chọn PostgreSQL 18:**
- ACID cho model configs — không thể mất hoặc corrupt config data
- Foreign keys giữa model_profiles → usage_records → benchmark_results
- SQL aggregation cho usage reports (SUM tokens, GROUP BY model, date ranges)
- `uuidv7()` native — time-sortable UUIDs, không cần external library
- Temporal constraints — model sessions không overlap thời gian
- Virtual generated columns — computed cost_estimate, display_name mà không store
- Skip scan indexes — fast multi-column queries (provider + status, model + date)

### 3.2 MongoDB — Unstructured Data

**Vai trò:** Lưu trữ dữ liệu có cấu trúc linh hoạt, JSON blobs lớn, embeddings.

| Collection | Purpose | Why MongoDB? |
|---|---|---|
| `conversations` | Chat sessions with full message history | Messages vary per provider (text, images, tool calls, attachments). Schema changes frequently. Nested arrays of messages. |
| `memory_entries` | Agent memory with embeddings | Vector arrays (float[]), variable metadata, flexible search patterns |
| `llm_responses` | Raw API responses from providers | Each provider returns different JSON structure. Large blobs (sometimes 10KB+). For debugging/audit only. |
| `prompt_templates` | Reusable prompt templates | Nested structures (variables, versions, examples, chains). Flexible schema evolution. |
| `knowledge_collections` | Knowledge base groupings | Flexible config per collection (chunk strategy, embedding model, search params) |
| `knowledge_documents` | Original uploaded documents | Variable source types (PDF, MD, URL, text). Metadata varies. Large content blobs. |
| `knowledge_chunks` | Chunked text + embedding vectors | Float arrays (384-3072 dims), variable chunk sizes. Core of vector search. |
| `embeddings` | Vector embeddings for RAG | Float arrays, similarity search, MongoDB Atlas Vector Search compatible |
| `error_logs` | Detailed error logs with context | Arbitrary JSON context, stack traces, request/response pairs |

**Lý do chọn MongoDB:**
- Chat messages schema khác nhau per provider (OpenAI có `tool_calls`, Anthropic có `content_blocks`, Ollama có `context`)
- Raw LLM responses là JSON blobs lớn — decompose vào relational tables sẽ rất phức tạp
- Embeddings cần document model — mỗi entry có vector + metadata + content
- Schema evolution: thêm fields cho messages/memory không cần migration
- Natural fit cho nested, hierarchical data (conversation → messages → content blocks → tool calls)

### 3.3 Data Flow Diagram

```
User types message
        │
        ▼
┌───────────────┐     ┌──────────────────────┐
│ Gateway/Agent │────▶│ LLM Router           │
│ receives msg  │     │ (select active model) │
└───────────────┘     └──────────┬───────────┘
                                 │
        ┌────────────────────────┼────────────────────┐
        │                        │                     │
        ▼                        ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐
│ PostgreSQL18 │  │   LLM Provider   │  │     MongoDB        │
│              │  │  (Ollama/OpenAI)  │  │                    │
│ Read model   │  │  Send prompt     │  │ Store conversation │
│ config +     │  │  Get response    │  │ Store raw response │
│ API key      │  │                  │  │ Update memory      │
│              │  │                  │  │                    │
│ Log usage    │  │                  │  │                    │
│ record       │  │                  │  │                    │
└──────────────┘  └──────────────────┘  └───────────────────┘
```

---

## 4. Skill Integration Architecture

### 4.1 SkillPlugin Lifecycle

```typescript
// packages/skills/src/model-management/index.ts

import { defineSkill } from '../../core/skills/skill-manager';
import { modelManagementManifest } from './manifest';

// Tool implementations
import { modelListTool, modelCreateTool, modelUpdateTool, modelDeleteTool } from './tools/model-crud.tools';
import { modelSwitchTool, modelGetActiveTool, modelBenchmarkTool, modelTestTool } from './tools/model-ops.tools';
import { ollamaListTool, ollamaPullTool, ollamaRemoveTool } from './tools/ollama.tools';
import { providerHealthCheckTool } from './tools/health.tools';
import { mcpRegisterTool, mcpListTool, mcpToggleTool, mcpHealthTool } from './tools/mcp.tools';
import { kbCreateCollectionTool, kbAddDocumentTool, kbSearchTool, kbListCollectionsTool, kbDeleteCollectionTool, kbDeleteDocumentTool } from './tools/knowledge.tools';

export const modelManagementSkill = defineSkill(modelManagementManifest, {
  // Model CRUD (4)
  model_list: modelListTool,
  model_create: modelCreateTool,
  model_update: modelUpdateTool,
  model_delete: modelDeleteTool,
  // Model Ops (4)
  model_switch: modelSwitchTool,
  model_get_active: modelGetActiveTool,
  model_benchmark: modelBenchmarkTool,
  model_test_connection: modelTestTool,
  // Ollama (3)
  ollama_list: ollamaListTool,
  ollama_pull: ollamaPullTool,
  ollama_remove: ollamaRemoveTool,
  // Health (1)
  provider_health_check: providerHealthCheckTool,
  // MCP (4)
  mcp_register: mcpRegisterTool,
  mcp_list: mcpListTool,
  mcp_toggle: mcpToggleTool,
  mcp_health: mcpHealthTool,
  // Knowledge / RAG (6)
  kb_create_collection: kbCreateCollectionTool,
  kb_add_document: kbAddDocumentTool,
  kb_search: kbSearchTool,
  kb_list_collections: kbListCollectionsTool,
  kb_delete_collection: kbDeleteCollectionTool,
  kb_delete_document: kbDeleteDocumentTool,
});
```

### 4.2 Activation Flow

```
SkillManager.activate('model-management')
    │
    ▼
modelManagementSkill.activate(context)
    │
    ├─── 1. Parse config from SkillContext
    │        pgConnectionString, mongoConnectionString, ollamaBaseUrl
    │
    ├─── 2. Initialize PostgreSQL 18 pool
    │        const pgPool = new Pool({ connectionString, max: 10 })
    │        Run migrations (001_initial.sql, 002_indexes.sql)
    │
    ├─── 3. Initialize MongoDB client
    │        const mongoClient = new MongoClient(mongoUrl)
    │        Create indexes (conversations, memory_entries)
    │
    ├─── 4. Register 22 tools via context.toolRegistry
    │        12 model/ollama/health + 4 MCP + 6 Knowledge/RAG
    │        Each tool gets (pgPool, mongoClient, ollamaBaseUrl) injected
    │
    ├─── 5. Initialize MCP Registry
    │        Load saved MCP server configs from PG18 (mcp_servers)
    │        Connect to enabled servers (stdio/sse/http transports)
    │        Cache discovered tools in mcp_tools table
    │        Bridge MCP tools → Agent ToolRegistry
    │
    ├─── 6. Initialize RAG Engine
    │        Create MongoDB Atlas Vector Search indexes on knowledge_chunks
    │        Load RAG configs from PG18 (rag_configs)
    │        Verify embedding model availability (Ollama nomic-embed-text or OpenAI)
    │
    ├─── 7. Auto-import .env config (if first boot)
    │        Read LLM_PROVIDER, LLM_MODEL from process.env
    │        Create default model profile in PG18
    │
    └─── 8. context.log('Model Management skill activated')
```

### 4.3 Tool → Service → Repository Flow

```
Agent LLM calls: model_create({ name: "GPT-4o", provider: "openai", ... })
    │
    ▼
┌─────────────────────────────┐
│ Tool Layer (model-crud.ts)  │
│ - Validates input            │
│ - Calls ModelService.create()│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Service Layer (model.svc)   │
│ - Business logic             │
│ - Encrypt API key            │
│ - Generate UUIDv7 (PG18)    │
│ - Emit 'model:created' event│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ PG Repository (model.repo)  │
│ - INSERT INTO model_profiles│
│ - Parameterized query        │
│ - RETURNING * with UUIDv7    │
└──────────────┬──────────────┘
               │
               ▼
         PostgreSQL 18
```

---

## 5. MCP Architecture — Chuyên đề (Domain-Based MCP)

### 5.1 MCP Concept

Model Context Protocol (MCP) cho phép Agent kết nối tới external tool servers. Mỗi MCP server là một **"chuyên đề" (domain)** cung cấp bộ công cụ chuyên biệt.

```
┌──────────────────────────────────────────────────────────────────┐
│                        xClaw Agent                                │
│                                                                    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐   │
│  │BuiltIn   │  │ Skill Tools  │  │   MCP Tool Bridge          │   │
│  │Tools (11) │  │ (12 model)   │  │   (dynamic, per server)    │   │
│  └──────────┘  └──────────────┘  └─────────┬─────────────────┘   │
│                                             │                      │
└─────────────────────────────────────────────┼──────────────────────┘
                                              │
              ┌───────────────────────────────┼──────────────────┐
              │              MCP Registry                         │
              │                                                   │
              │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
              │  │ Code &  │ │ Web &   │ │ Data &  │ │Producti│ │
              │  │  Dev    │ │ Browser │ │   DB    │ │  vity  │ │
              │  └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │
              │       │           │           │          │       │
              │  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌──┴─────┐│
              │  │Knowledge│ │ DevOps  │ │  Media  │ │ Custom ││
              │  │  & AI   │ │         │ │         │ │        ││
              │  └─────────┘ └─────────┘ └─────────┘ └────────┘│
              └──────────────────────────────────────────────────┘
                          │           │           │
                    ┌─────▼───┐ ┌─────▼───┐ ┌─────▼───┐
                    │  stdio  │ │   SSE   │ │  HTTP   │
                    │ process │ │ stream  │ │ stream  │
                    └─────────┘ └─────────┘ └─────────┘
```

### 5.2 MCP Domain Categories (8 chuyên đề)

| # | Domain | Ví dụ MCP Servers | Transport phổ biến |
|---|--------|-------------------|-------------------|
| 1 | **Code & Dev** | GitHub MCP, GitLab MCP, File System MCP | stdio |
| 2 | **Web & Browser** | Chrome DevTools MCP, Puppeteer MCP, Playwright MCP | stdio, SSE |
| 3 | **Data & Database** | PostgreSQL MCP, MongoDB MCP, SQLite MCP | stdio |
| 4 | **Productivity** | Google Workspace MCP, Notion MCP, Slack MCP, Linear MCP | SSE, HTTP |
| 5 | **Knowledge & AI** | Web Search MCP, Wikipedia MCP, ArXiv MCP, Brave Search MCP | stdio, HTTP |
| 6 | **DevOps** | Docker MCP, Kubernetes MCP, AWS MCP, Terraform MCP | stdio |
| 7 | **Media** | Image Generation MCP, FFmpeg MCP, Screenshot MCP | stdio |
| 8 | **Custom** | User-defined MCP servers | any |

### 5.3 MCP Client Architecture

```typescript
// mcp/mcp-client.ts — Kết nối tới 1 MCP server
interface MCPClientConfig {
  id: string;                                // uuidv7
  name: string;                              // "GitHub MCP"
  domain: MCPDomain;                         // 'code' | 'web' | 'data' | ...
  transport: 'stdio' | 'sse' | 'streamable-http';
  command?: string;                          // stdio: "npx @modelcontextprotocol/server-github"
  url?: string;                              // SSE/HTTP: "http://localhost:3001/mcp"
  env?: Record<string, string>;              // Environment variables (e.g., GITHUB_TOKEN)
  enabled: boolean;
  autoConnect: boolean;                      // Connect on skill activation
}

class MCPClient {
  private transport: StdioClientTransport | SSEClientTransport | StreamableHTTPTransport;
  private client: Client;                    // from @modelcontextprotocol/sdk
  
  async connect(): Promise<void>;            // Establish connection
  async listTools(): Promise<MCPToolSchema[]>;  // Discover tools from server
  async callTool(name: string, args: unknown): Promise<unknown>;  // Invoke tool
  async disconnect(): Promise<void>;         // Graceful close
  async healthCheck(): Promise<MCPHealthStatus>;  // Ping server
}
```

### 5.4 MCP Registry — Tool Bridge

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Registry Flow                            │
│                                                                   │
│  1. User registers MCP server (mcp_register tool)                │
│     → Save config to PG18 mcp_servers table                     │
│                                                                   │
│  2. MCPClient.connect() → handshake with server                  │
│     → Server responds with capabilities                          │
│                                                                   │
│  3. MCPClient.listTools() → discover available tools             │
│     → Cache tool schemas in PG18 mcp_tools table                │
│                                                                   │
│  4. MCP Tool Bridge → inject discovered tools into Agent         │
│     → Each MCP tool becomes callable by Agent LLM               │
│     → Tool name prefixed: "mcp_{serverName}_{toolName}"         │
│                                                                   │
│  5. Agent calls "mcp_github_create_issue"                        │
│     → Bridge routes to GitHub MCP server                         │
│     → MCPClient.callTool("create_issue", args)                  │
│     → Response returned to Agent                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.5 MCP Preset Servers

Built-in presets để user nhanh chóng enable các MCP server phổ biến:

```typescript
// mcp/mcp-presets.ts
export const MCP_PRESETS: MCPClientConfig[] = [
  {
    name: 'GitHub',
    domain: 'code',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-github',
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '{{GITHUB_TOKEN}}' },
  },
  {
    name: 'Chrome DevTools',
    domain: 'web',
    transport: 'stdio',
    command: 'npx -y @anthropic/mcp-chrome-devtools',
  },
  {
    name: 'PostgreSQL',
    domain: 'data',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-postgres',
    env: { POSTGRES_CONNECTION_STRING: '{{PG_URL}}' },
  },
  {
    name: 'Brave Search',
    domain: 'knowledge',
    transport: 'stdio',
    command: 'npx -y @anthropic/mcp-brave-search',
    env: { BRAVE_API_KEY: '{{BRAVE_KEY}}' },
  },
  // ... more presets
];
```

### 5.6 MCP Lifecycle

```
                    ┌──────────┐
                    │ DISABLED │
                    └────┬─────┘
            mcp_toggle   │
            (enable)     ▼
                    ┌──────────┐
              ┌─────│ ENABLED  │─────┐
              │     └──────────┘     │
      connect │                       │ connect fails
              ▼                       ▼
        ┌──────────┐           ┌──────────┐
        │CONNECTED │           │  ERROR   │
        │ (active) │           │(retry 3x)│
        └──────────┘           └──────────┘
              │
              │ disconnect / crash
              ▼
        ┌──────────────┐
        │ DISCONNECTED │──▶ auto-reconnect (if autoConnect=true)
        └──────────────┘
```

---

## 6. RAG Pipeline Architecture

### 6.1 Overview

RAG (Retrieval-Augmented Generation) cho phép Agent sử dụng knowledge base riêng để trả lời chính xác hơn. Pipeline:

```
┌───────────────────────────────────────────────────────────────────┐
│                    RAG Pipeline — 2 Phases                        │
│                                                                    │
│  ═══════ PHASE 1: Document Ingestion ═══════                     │
│                                                                    │
│  Upload      Parse       Chunk       Embed        Store           │
│  ┌─────┐   ┌──────┐   ┌───────┐   ┌────────┐   ┌────────────┐  │
│  │ PDF │──▶│ Text │──▶│ 512   │──▶│ nomic- │──▶│ MongoDB    │  │
│  │ MD  │   │ plain│   │ token │   │ embed- │   │ knowledge_ │  │
│  │ TXT │   │      │   │chunks │   │ text   │   │ chunks     │  │
│  │ URL │   │      │   │       │   │ 768dim │   │ (+ vector  │  │
│  │ HTML│   │      │   │       │   │        │   │   index)   │  │
│  └─────┘   └──────┘   └───────┘   └────────┘   └────────────┘  │
│                                                                    │
│  ═══════ PHASE 2: Query & Retrieval ═══════                      │
│                                                                    │
│  User        Embed       Vector        Context      LLM          │
│  Query       Query       Search        Inject       Response     │
│  ┌─────┐   ┌───────┐   ┌────────┐   ┌──────────┐  ┌─────────┐  │
│  │"How │──▶│embed( │──▶│$vector │──▶│Top-K     │──▶│ Ollama/ │  │
│  │ to  │   │query) │   │Search  │   │chunks +  │  │ OpenAI  │  │
│  │ ..."│   │768dim │   │cosine  │   │user query│  │ answer  │  │
│  └─────┘   └───────┘   │sim>0.7 │   │= augment │  └─────────┘  │
│                         └────────┘   │  prompt  │               │
│                                      └──────────┘               │
└───────────────────────────────────────────────────────────────────┘
```

### 6.2 Knowledge Hierarchy

```
Knowledge Base (xClaw)
│
├── Collection: "xClaw Documentation"     ← Grouping = folder
│   ├── Document: "README.md"             ← Original file
│   │   ├── Chunk 1: "# xClaw\nxClaw is..." (512 tokens, embedding[768])
│   │   ├── Chunk 2: "## Installation\n..."  (512 tokens, embedding[768])
│   │   └── Chunk 3: "## Usage\n..."         (410 tokens, embedding[768])
│   ├── Document: "API-Guide.pdf"
│   │   ├── Chunk 1...
│   │   └── Chunk N...
│   └── Document: "https://xclaw.dev/docs"  ← URL source
│       └── Chunks...
│
├── Collection: "TypeScript Best Practices"
│   └── ...
│
└── Collection: "Company Wiki"
    └── ...
```

### 6.3 Chunking Strategy

```typescript
// rag/chunker.ts
interface ChunkConfig {
  maxTokens: number;       // Default: 512
  overlap: number;         // Default: 50 tokens (10% overlap)
  strategy: 'recursive' | 'sentence' | 'paragraph' | 'fixed';
}

// Recursive strategy (xịion nhất):
// 1. Split by "\n\n" (paragraphs)
// 2. If chunk > maxTokens → split by "\n" (lines)
// 3. If still > maxTokens → split by ". " (sentences)
// 4. If still > maxTokens → split by " " (words)
// 5. Apply overlap: last N tokens of chunk_i = first N tokens of chunk_i+1
```

### 6.4 Embedding Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Embedding Strategy                            │
│                                                                │
│  Priority 1: Ollama local (nomic-embed-text)                  │
│    ✓ Free, no API key                                         │
│    ✓ 768 dimensions                                           │
│    ✓ ~500 tokens/sec on CPU (i5-13400)                        │
│    ✗ Requires model pulled: ollama pull nomic-embed-text      │
│                                                                │
│  Priority 2: OpenAI (text-embedding-3-small)                  │
│    ✓ 1536 dimensions, higher quality                          │
│    ✓ 8191 max input tokens                                    │
│    ✗ Costs $0.02/1M tokens                                    │
│    ✗ Requires API key                                         │
│                                                                │
│  Fallback: existing OpenAIAdapter.embed() in LLM Router      │
│    Already implemented in packages/core/src/llm/llm-router.ts │
└──────────────────────────────────────────────────────────────┘
```

### 6.5 Vector Search (MongoDB)

```typescript
// rag/vector-search.ts
// Uses MongoDB Atlas Vector Search or local $vectorSearch

// MongoDB index definition:
{
  "mappings": {
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 768,        // match embedding model
        "similarity": "cosine"
      }
    }
  }
}

// Search query:
db.knowledge_chunks.aggregate([
  {
    $vectorSearch: {
      index: "chunk_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,  // float[768]
      numCandidates: 100,
      limit: 5,                     // top-K
      filter: { collectionId: "..." }  // scope to collection
    }
  },
  {
    $project: {
      content: 1,
      documentId: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
]);
```

### 6.6 RAG Context Injection

```
Agent.buildMessages() — Updated flow with RAG:

1. Get system prompt
2. Get conversation history
3. Get memory entries (existing)          ← MemoryManager.recall()
4. ★ NEW: RAG context injection           ← RAG Engine
   │
   ├── Extract user query from last message
   ├── Embed query → vector[768]
   ├── Vector search in knowledge_chunks (top-5)
   ├── Filter by score > 0.7 (relevance threshold)
   ├── Format: "Relevant knowledge:\n[chunk1]\n[chunk2]..."
   └── Inject into system prompt as context block
5. Build final messages array
6. Send to LLM

System prompt with RAG context:
┌─────────────────────────────────────────────────┐
│ You are xClaw AI Agent...                        │
│                                                   │
│ ## Relevant Knowledge (from knowledge base):     │
│ [1] xClaw uses PostgreSQL 18 for structured...   │
│ [2] The defineSkill pattern requires...          │
│ [3] MCP servers connect via stdio transport...   │
│                                                   │
│ ## Memories:                                      │
│ - [fact] User prefers dark mode                  │
│ - [preference] Always use TypeScript             │
│                                                   │
│ Use the knowledge above to answer accurately.    │
└─────────────────────────────────────────────────┘
```

### 6.7 RAG → Existing MemoryManager Integration

```
Existing (MemoryManager):           RAG Engine (NEW):
┌───────────────────┐          ┌─────────────────────────┐
│ memory_entries     │          │ knowledge_chunks         │
│ (agent memories)   │          │ (uploaded documents)     │
│                    │          │                          │
│ recall(query)      │          │ search(query, topK)     │
│ → in-memory store  │          │ → MongoDB vector search │
│ → text fallback    │          │ → score threshold       │
└────────┬──────────┘          └────────┬────────────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
                    ▼
         buildMessages() injects BOTH:
         - Agent memories (short, facts)
         - RAG knowledge (long, documents)
```

---

## 7. Security Architecture

### 5.1 API Key Encryption
> **MCP Security**: MCP server env vars (tokens, API keys) được encrypt với AES-256-GCM trước khi lưu vào PG18 mcp_servers.env_encrypted.
```
┌──────────────────────────────────────────┐
│ API Key Storage Flow                      │
│                                           │
│  User input: sk-abc123...                │
│       │                                   │
│       ▼                                   │
│  AES-256-GCM Encrypt                     │
│  (key from ENCRYPTION_KEY env var)        │
│       │                                   │
│       ▼                                   │
│  Store in PG18: encrypted_api_key column  │
│  + iv column + auth_tag column            │
│                                           │
│  On read → decrypt in memory only         │
│  NEVER return decrypted key in API        │
└──────────────────────────────────────────┘
```

### 7.2 SQL Injection Prevention
- All PG queries use parameterized queries (`$1`, `$2`, ...)
- No string interpolation in SQL
- MongoDB queries use typed filters, no `$where` or string eval

### 7.3 Input Validation
- All tool inputs validated at Tool Layer before reaching Service
- Provider enum whitelist: `['ollama', 'openai', 'anthropic', 'google', 'custom']`
- Model names sanitized (alphanumeric + `./-:` only)

---

## 8. Event Architecture

### 8.1 EventBus Events

Model Management skill emits events via `SkillContext.eventBus`:

| Event | Payload | When |
|---|---|---|
| `model:created` | `{ profileId, name, provider }` | New model profile created |
| `model:updated` | `{ profileId, changes }` | Model config updated |
| `model:deleted` | `{ profileId }` | Model soft-deleted |
| `model:switched` | `{ from, to, scope }` | Active model changed |
| `model:benchmark:complete` | `{ profileId, results }` | Benchmark finished |
| `model:health:changed` | `{ provider, status }` | Provider health changed |
| `ollama:pull:progress` | `{ name, percent }` | Download progress |
| `ollama:pull:complete` | `{ name, profileId }` | Download finished |
| `mcp:server:registered` | `{ serverId, name, domain }` | MCP server registered |
| `mcp:server:connected` | `{ serverId, toolCount }` | MCP server connected, tools discovered |
| `mcp:server:disconnected` | `{ serverId, reason }` | MCP server disconnected |
| `mcp:server:error` | `{ serverId, error }` | MCP server error |
| `mcp:tool:invoked` | `{ serverId, toolName, success }` | MCP tool called by Agent |
| `rag:document:added` | `{ collectionId, documentId, chunkCount }` | Document ingested |
| `rag:document:deleted` | `{ collectionId, documentId }` | Document removed |
| `rag:collection:created` | `{ collectionId, name }` | Knowledge collection created |
| `rag:collection:deleted` | `{ collectionId }` | Knowledge collection deleted |
| `rag:search:complete` | `{ query, resultCount, latencyMs }` | RAG search finished |
| `rag:embedding:progress` | `{ documentId, chunksProcessed, total }` | Embedding generation progress |

### 8.2 WebSocket Event Forwarding

Gateway forwards EventBus events to WebSocket clients:

```typescript
eventBus.on('model:*|mcp:*|rag:*', (event, payload) => {
  gateway.broadcast({
    type: 'skill:event',
    skill: 'model-management',
    event,
    payload,
  });
});
```

---

## 9. Connection Management

### 9.1 PostgreSQL 18 Pool

```typescript
import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: config.pgConnectionString, 
  // postgresql://xclaw:xclaw@localhost:5432/xclaw
  max: 10,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle after 30s
  connectionTimeoutMillis: 5000,
});
```

### 9.2 MongoDB Client

```typescript
import { MongoClient } from 'mongodb';

const mongoClient = new MongoClient(config.mongoConnectionString, {
  // mongodb://localhost:27017/xclaw
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
});
const db = mongoClient.db('xclaw');
```

### 9.3 Graceful Degradation

```
┌──────────────────────────────────────────────────┐
│ Degradation Strategy                              │
│                                                    │
│ Both DBs UP → Full functionality                  │
│                                                    │
│ PG DOWN, Mongo UP:                                │
│   → Model config from .env fallback               │
│   → Chat history still works                      │
│   → Usage tracking queued in memory               │
│   → Log warning, attempt reconnect                │
│                                                    │
│ Mongo DOWN, PG UP:                                │
│   → Model management works                        │
│   → Chat history not persisted (memory only)      │
│   → Embeddings unavailable                        │
│   → Log warning, attempt reconnect                │
│                                                    │
│ Both DOWN:                                        │
│   → .env fallback for model config                │
│   → In-memory chat only                           │
│   → All skill tools return degraded status        │
└──────────────────────────────────────────────────┘
```

---

## 10. Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| PostgreSQL driver | `pg` (node-postgres) | Most mature, connection pooling, PG18 compatible |
| MongoDB driver | `mongodb` (official) | Official driver, TypeScript types, stable |
| UUID generation | PG18 `uuidv7()` | Native, no external lib, time-sortable |
| API key encryption | Node.js `crypto` (AES-256-GCM) | Standard library, no dependency |
| Migration tool | Raw SQL files | Simple, version controlled, no ORM overhead |
| Skill pattern | `defineSkill()` | Follows existing xClaw convention exactly |
| MCP protocol | `@modelcontextprotocol/sdk` | Official SDK, supports stdio + SSE + streamable HTTP |
| Text chunking | Custom recursive splitter | No heavy dependency. Token-aware split by paragraph → sentence → word |
| Embedding model | `nomic-embed-text` (Ollama) / `text-embedding-3-small` (OpenAI) | Local-first via Ollama, OpenAI fallback for quality |
| Vector search | MongoDB Atlas Vector Search | Native $vectorSearch aggregation, no separate vector DB needed |
| Document parsing | `pdf-parse` + custom MD/HTML | Minimal deps. PDF → text, MD → plain, HTML → text via sanitize |
| Docker | docker-compose services | PG18 + Mongo + Ollama in one stack |

---

## 11. Docker Compose Integration

```yaml
# Addition to existing docker-compose.yml
services:
  postgres:
    image: postgres:18
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: xclaw
      POSTGRES_PASSWORD: xclaw
      POSTGRES_DB: xclaw
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U xclaw"]
      interval: 5s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  mongodata:
```
