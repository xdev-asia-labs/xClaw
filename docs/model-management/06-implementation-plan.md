# Implementation Plan
## xClaw Model Management Skill
**Version:** 3.0.0  
**Date:** 2026-03-16

---

## 1. Overview

### 1.1 Scope
Implement Model Management as a SkillPlugin with:
- **PostgreSQL 18** — structured data (model profiles, usage, benchmarks, sessions, MCP servers, RAG configs, audit)
- **MongoDB** — unstructured data (conversations, memory, raw responses, templates, knowledge base)
- **22 Skill tools** — 12 model/ollama/health + 4 MCP + 6 Knowledge/RAG via `defineSkill()`
- **MCP Server Management** — register, connect, discover tools by domain (8 chuyên đề)
- **RAG Pipeline** — document ingestion (parse → chunk → embed → store), semantic search, context injection
- **REST API** — wrapping same service layer for Web UI
- **React UI** — model management + MCP servers + Knowledge Base pages

### 1.2 Dependencies

```json
{
  "dependencies": {
    "pg": "^8.13.0",
    "mongodb": "^6.12.0",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "pdf-parse": "^1.1.1"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0"
  }
}
```

### 1.3 Infrastructure

| Service | Image | Port | Status |
|---|---|---|---|
| PostgreSQL 18 | `postgres:18` | 5432 | New (docker-compose) |
| MongoDB 7 | `mongo:7` | 27017 | New (docker-compose) |
| Ollama | local install | 11434 | Existing |
| xClaw Gateway | local | 18789 | Existing |
| xClaw Web UI | local | 3000 | Existing |

---

## 2. Implementation Phases

### Phase 1: Infrastructure & Database (Foundation)

**Goal:** Databases running, connections working, migrations ready.

| Task | Description | Files |
|---|---|---|
| 1.1 | Update docker-compose.yml: add postgres:18 + mongo:7 services | `docker-compose.yml` |
| 1.2 | Update .env with DB connection strings | `.env`, `.env.example` |
| 1.3 | Create PG connection module with pool | `repositories/pg/connection.ts` |
| 1.4 | Create MongoDB connection module | `repositories/mongo/connection.ts` |
| 1.5 | Write PG migration 001: all tables | `repositories/pg/migrations/001_initial.sql` |
| 1.6 | Write PG migration 002: indexes | `repositories/pg/migrations/002_indexes.sql` |
| 1.7 | Write PG migration 003: MCP + RAG tables | `repositories/pg/migrations/003_mcp_rag.sql` |
| 1.8 | Create migration runner | `repositories/pg/migrations/runner.ts` |
| 1.9 | Create MongoDB index setup (incl. vector search) | `repositories/mongo/setup-indexes.ts` |
| 1.10 | Add shared types to `@xclaw/shared` (incl. MCP + RAG types) | `packages/shared/src/types/index.ts` |

**Deliverable:** `docker compose up` starts PG18 + Mongo, migrations run on skill activate.

---

### Phase 2: Skill Skeleton & Model CRUD

**Goal:** Skill registers, activates, 4 CRUD tools working.

| Task | Description | Files |
|---|---|---|
| 2.1 | Create skill manifest | `manifest.ts` |
| 2.2 | Create skill entry point with `defineSkill()` | `index.ts` |
| 2.3 | Implement PG model repository | `repositories/pg/model.repo.ts` |
| 2.4 | Implement ModelService | `services/model.service.ts` |
| 2.5 | Implement AES-256-GCM encryption | `crypto/key-encryption.ts` |
| 2.6 | Implement 4 CRUD tools | `tools/model-crud.tools.ts` |
| 2.7 | Register skill in server startup | `packages/server/src/index.ts` |
| 2.8 | Add REST routes for model CRUD | Gateway routes |
| 2.9 | Auto-import from .env on first boot | `services/model.service.ts` |

**Deliverable:** `model_list`, `model_create`, `model_update`, `model_delete` tools working. Agent can manage models via tool calling.

---

### Phase 3: Ollama Integration & Model Switching

**Goal:** Pull/remove Ollama models, switch active model.

| Task | Description | Files |
|---|---|---|
| 3.1 | Implement OllamaService | `services/ollama.service.ts` |
| 3.2 | Implement Ollama tools (list, pull, remove) | `tools/ollama.tools.ts` |
| 3.3 | WebSocket progress events for pull | Gateway WS events |
| 3.4 | Implement PG session repository | `repositories/pg/session.repo.ts` |
| 3.5 | Implement model_switch tool | `tools/model-ops.tools.ts` |
| 3.6 | Implement model_get_active tool | `tools/model-ops.tools.ts` |
| 3.7 | Integrate with LLM Router | Update `llm-router.ts` |
| 3.8 | Auto-create profile after Ollama pull | `services/ollama.service.ts` |

**Deliverable:** Full Ollama management + model switching via tools.

---

### Phase 4: Benchmark & Usage Tracking

**Goal:** Benchmark runner, token tracking, cost estimation.

| Task | Description | Files |
|---|---|---|
| 4.1 | Implement BenchmarkService | `services/benchmark.service.ts` |
| 4.2 | Implement model_benchmark tool | `tools/model-ops.tools.ts` |
| 4.3 | Implement PG benchmark repository | `repositories/pg/benchmark.repo.ts` |
| 4.4 | Implement UsageService | `services/usage.service.ts` |
| 4.5 | Implement PG usage repository | `repositories/pg/usage.repo.ts` |
| 4.6 | Hook usage tracking into LLM Router | Middleware pattern |
| 4.7 | Virtual generated column for cost_estimate | PG18 migration |

**Deliverable:** Automated benchmark runner, real-time token tracking with cost estimates.

---

### Phase 5: MongoDB Collections (Conversations, Memory)

**Goal:** Chat history persistence, memory/embeddings storage.

| Task | Description | Files |
|---|---|---|
| 5.1 | Implement conversation repository | `repositories/mongo/conversation.repo.ts` |
| 5.2 | Implement ConversationService | `services/conversation.service.ts` |
| 5.3 | Implement memory repository | `repositories/mongo/memory.repo.ts` |
| 5.4 | Implement MemoryService | `services/memory.service.ts` |
| 5.5 | Implement llm_responses repository | `repositories/mongo/response.repo.ts` |
| 5.6 | Hook conversation saving into chat flow | Gateway integration |
| 5.7 | Hook raw response logging | LLM Router middleware |

**Deliverable:** Chat history saved to MongoDB, memory entries with embeddings, raw response audit logging.

---

### Phase 6: Health Monitoring & Audit

**Goal:** Provider health checks, audit trail, graceful degradation.

| Task | Description | Files |
|---|---|---|
| 6.1 | Implement HealthService | `services/health.service.ts` |
| 6.2 | Implement provider_health_check tool | `tools/health.tools.ts` |
| 6.3 | Implement model_test_connection tool | `tools/model-ops.tools.ts` |
| 6.4 | Implement PG audit repository | `repositories/pg/audit.repo.ts` |
| 6.5 | Add audit logging to all write operations | Service layer |
| 6.6 | Implement graceful degradation | Connection modules |
| 6.7 | Periodic health check interval | Activated in skill lifecycle |

**Deliverable:** Full health monitoring, audit trail, system works even if one DB is down.

---

### Phase 7: React UI (Web)

**Goal:** Full model management UI in React.

| Task | Description | Files |
|---|---|---|
| 7.1 | Create Zustand stores (models, benchmarks, usage) | `hooks/useModels.ts`, etc. |
| 7.2 | WebSocket hook for real-time events | `hooks/useModelWebSocket.ts` |
| 7.3 | ModelListPage + ModelCard | `components/models/` |
| 7.4 | ModelFormModal (add/edit) | `ModelFormModal.tsx` |
| 7.5 | ModelSwitcher dropdown (for chat page) | `ModelSwitcher.tsx` |
| 7.6 | OllamaRegistryPanel + PullProgress | `OllamaRegistryPanel.tsx` |
| 7.7 | BenchmarkPanel + Charts | `BenchmarkPanel.tsx` |
| 7.8 | UsageStatsPanel + Charts | `UsageStatsPanel.tsx` |
| 7.9 | HealthStatusBar | `HealthStatusBar.tsx` |
| 7.10 | Add Models tab to main navigation | `App.tsx` |

**Deliverable:** Full UI matching wireframes in doc 05.

---

### Phase 8: MCP Server Integration

**Goal:** Register, connect, manage MCP servers by domain. Bridge MCP tools into Agent.

| Task | Description | Files |
|---|---|---|
| 8.1 | Install `@modelcontextprotocol/sdk` | `package.json` |
| 8.2 | Implement MCPClient (stdio/sse/http transports) | `mcp/mcp-client.ts` |
| 8.3 | Implement MCP Registry (server lifecycle, tool bridge) | `mcp/mcp-registry.ts` |
| 8.4 | Create MCP presets (GitHub, Chrome DevTools, PG, Brave) | `mcp/mcp-presets.ts` |
| 8.5 | Implement PG mcp_servers repository | `repositories/pg/mcp.repo.ts` |
| 8.6 | Implement MCPService (register, toggle, health, tool discovery) | `services/mcp.service.ts` |
| 8.7 | Implement 4 MCP tools (register, list, toggle, health) | `tools/mcp.tools.ts` |
| 8.8 | Add REST routes: `/api/mcp/*` | Gateway MCP routes |
| 8.9 | MCP → Agent ToolRegistry bridge (inject dynamic tools) | `mcp/mcp-registry.ts` |
| 8.10 | MCP EventBus events (connected, disconnected, error) | EventBus integration |
| 8.11 | MCP auto-reconnect on disconnect | `mcp/mcp-client.ts` |
| 8.12 | Encrypt MCP env vars in PG (same AES-256-GCM) | `services/mcp.service.ts` |

**Deliverable:** Agent can connect to MCP servers, discover tools, and call them. Users manage servers via REST API or tools.

---

### Phase 9: RAG Pipeline (Knowledge Base)

**Goal:** Document ingestion pipeline, vector search, context injection into Agent prompt.

| Task | Description | Files |
|---|---|---|
| 9.1 | Implement document parser (PDF, MD, TXT, HTML) | `rag/document-parser.ts` |
| 9.2 | Install `pdf-parse` for PDF support | `package.json` |
| 9.3 | Implement text chunker (recursive strategy) | `rag/chunker.ts` |
| 9.4 | Implement embedder (Ollama nomic-embed-text + OpenAI fallback) | `rag/embedder.ts` |
| 9.5 | Implement vector search (MongoDB $vectorSearch + cosine fallback) | `rag/vector-search.ts` |
| 9.6 | Implement MongoDB knowledge repos (collections, documents, chunks) | `repositories/mongo/knowledge.repo.ts`, `chunk.repo.ts` |
| 9.7 | Implement PG rag_configs & rag_query_log repos | `repositories/pg/rag.repo.ts` |
| 9.8 | Implement KnowledgeService (collection CRUD, document ingestion) | `services/knowledge.service.ts` |
| 9.9 | Implement RAGService (ingestion pipeline, search, context format) | `services/rag.service.ts` |
| 9.10 | Implement 6 Knowledge tools | `tools/knowledge.tools.ts` |
| 9.11 | Add REST routes: `/api/knowledge/*` | Gateway knowledge routes |
| 9.12 | ★ Integrate RAG into Agent.buildMessages() — context injection | `packages/core/src/agent/agent.ts` |
| 9.13 | Create MongoDB vector search index on knowledge_chunks | `repositories/mongo/setup-indexes.ts` |
| 9.14 | RAG EventBus events (document:added, embedding:progress, search) | EventBus integration |
| 9.15 | Pull `nomic-embed-text` as default embedding model | Ollama auto-setup |

**Deliverable:** Users upload documents → auto chunk + embed → stored in MongoDB. Agent queries trigger vector search and inject relevant chunks into prompt. Full RAG pipeline operational.

---

### Phase 10: MCP + Knowledge UI (React)

**Goal:** Full MCP and Knowledge Base management UI.

| Task | Description | Files |
|---|---|---|
| 10.1 | Create Zustand stores (MCP servers, knowledge) | `hooks/useMCPServers.ts`, `useKnowledge.ts` |
| 10.2 | MCP WebSocket hook for events | `hooks/useMCPWebSocket.ts` |
| 10.3 | Knowledge WebSocket hook for ingestion progress | `hooks/useKnowledgeWebSocket.ts` |
| 10.4 | MCPServerListPage (grouped by domain) | `components/mcp/MCPServerListPage.tsx` |
| 10.5 | MCPPresetsModal (quick setup) | `components/mcp/MCPPresetsModal.tsx` |
| 10.6 | MCPAddServerModal (custom server) | `components/mcp/MCPAddServerModal.tsx` |
| 10.7 | MCPToolsViewer (view discovered tools) | `components/mcp/MCPToolsViewer.tsx` |
| 10.8 | KnowledgeOverviewPage (collections list) | `components/knowledge/KnowledgeOverviewPage.tsx` |
| 10.9 | CollectionDetailPage (documents list) | `components/knowledge/CollectionDetailPage.tsx` |
| 10.10 | AddDocumentModal (upload/paste/URL) | `components/knowledge/AddDocumentModal.tsx` |
| 10.11 | ChunkViewerPanel (view chunks of a document) | `components/knowledge/ChunkViewerPanel.tsx` |
| 10.12 | SemanticSearchPage (knowledge search) | `components/knowledge/SemanticSearchPage.tsx` |
| 10.13 | RAGSettingsPanel (embedding, chunking, search config) | `components/knowledge/RAGSettingsPanel.tsx` |
| 10.14 | IngestionProgress (WebSocket progress bar) | `components/knowledge/IngestionProgress.tsx` |
| 10.15 | Add MCP Servers + Knowledge Base tabs to navigation | `App.tsx` |

**Deliverable:** Full UI matching wireframes for MCP (section 8) and Knowledge Base (section 9) in doc 05.

---

## 3. File Structure (Complete)

```
packages/skills/src/model-management/
├── index.ts                           # defineSkill() entry (22 tools)
├── manifest.ts                        # SkillManifest
├── types/
│   └── index.ts                       # ModelProfile, BenchmarkResult, MCPServer, KBCollection, etc.
├── crypto/
│   └── key-encryption.ts              # AES-256-GCM encrypt/decrypt
├── services/
│   ├── model.service.ts               # Model CRUD + auto-import
│   ├── ollama.service.ts              # Ollama API integration
│   ├── benchmark.service.ts           # Benchmark runner
│   ├── usage.service.ts               # Token tracking
│   ├── conversation.service.ts        # Chat history (Mongo)
│   ├── memory.service.ts              # Memory + embeddings (Mongo)
│   ├── health.service.ts              # Provider health checks
│   ├── mcp.service.ts                 # MCP server lifecycle & tool discovery
│   ├── rag.service.ts                 # RAG pipeline: ingest, search, inject
│   └── knowledge.service.ts           # Knowledge base CRUD
├── repositories/
│   ├── pg/
│   │   ├── connection.ts              # Pool setup + migrations
│   │   ├── migrations/
│   │   │   ├── 001_initial.sql        # Core tables
│   │   │   ├── 002_indexes.sql        # Core indexes
│   │   │   ├── 003_mcp_rag.sql        # MCP + RAG tables & indexes
│   │   │   └── runner.ts              # Migration executor
│   │   ├── model.repo.ts
│   │   ├── usage.repo.ts
│   │   ├── benchmark.repo.ts
│   │   ├── session.repo.ts
│   │   ├── mcp.repo.ts               # mcp_servers + mcp_tools
│   │   ├── rag.repo.ts               # rag_configs + rag_query_log
│   │   └── audit.repo.ts
│   └── mongo/
│       ├── connection.ts              # MongoClient setup
│       ├── setup-indexes.ts           # Index creation (incl. vector search)
│       ├── conversation.repo.ts
│       ├── memory.repo.ts
│       ├── response.repo.ts
│       ├── template.repo.ts
│       ├── knowledge.repo.ts          # knowledge_collections + knowledge_documents
│       └── chunk.repo.ts             # knowledge_chunks + vector search queries
├── mcp/
│   ├── mcp-client.ts                  # MCP protocol client (stdio/sse/http)
│   ├── mcp-registry.ts               # Server registry + Agent tool bridge
│   └── mcp-presets.ts                 # Built-in presets by domain
├── rag/
│   ├── chunker.ts                     # Text splitter (recursive, token-aware)
│   ├── embedder.ts                    # Embed via Ollama/OpenAI
│   ├── vector-search.ts              # MongoDB vector search + cosine fallback
│   └── document-parser.ts            # Parse PDF, MD, TXT, DOCX, HTML
└── tools/
    ├── model-crud.tools.ts            # 4 CRUD tools
    ├── model-ops.tools.ts             # switch, active, benchmark, test
    ├── ollama.tools.ts                # 3 Ollama tools
    ├── health.tools.ts                # health check tool
    ├── mcp.tools.ts                   # 4 MCP tools (register, list, toggle, health)
    └── knowledge.tools.ts             # 6 Knowledge tools (create, add, search, list, delete x2)

packages/web/src/components/models/
├── ModelListPage.tsx
├── ModelCard.tsx
├── ModelFormModal.tsx
├── ModelSwitcher.tsx
├── OllamaRegistryPanel.tsx
├── OllamaPullProgress.tsx
├── BenchmarkPanel.tsx
├── BenchmarkChart.tsx
├── UsageStatsPanel.tsx
├── UsageChart.tsx
├── HealthStatusBar.tsx
└── hooks/
    ├── useModels.ts
    ├── useBenchmarks.ts
    ├── useUsageStats.ts
    ├── useOllama.ts
    └── useModelWebSocket.ts

packages/web/src/components/mcp/
├── MCPServerListPage.tsx
├── MCPServerCard.tsx
├── MCPPresetsModal.tsx
├── MCPAddServerModal.tsx
├── MCPToolsViewer.tsx
├── MCPHealthDashboard.tsx
└── hooks/
    ├── useMCPServers.ts
    ├── useMCPTools.ts
    └── useMCPWebSocket.ts

packages/web/src/components/knowledge/
├── KnowledgeOverviewPage.tsx
├── CollectionCard.tsx
├── CollectionDetailPage.tsx
├── CreateCollectionModal.tsx
├── AddDocumentModal.tsx
├── ChunkViewerPanel.tsx
├── SemanticSearchPage.tsx
├── RAGSettingsPanel.tsx
├── IngestionProgress.tsx
└── hooks/
    ├── useKnowledge.ts
    ├── useRAGSearch.ts
    ├── useRAGSettings.ts
    └── useKnowledgeWebSocket.ts
```

---

## 4. Environment Variables

```bash
# .env additions
# PostgreSQL 18
PG_CONNECTION_STRING=postgresql://xclaw:xclaw@localhost:5432/xclaw

# MongoDB
MONGO_CONNECTION_STRING=mongodb://localhost:27017/xclaw

# Encryption key for API keys (generate: openssl rand -hex 32)
ENCRYPTION_KEY=your-256-bit-hex-key-here

# Ollama (existing)
OLLAMA_BASE_URL=http://localhost:11434

# MCP Server Defaults
MCP_STDIO_TIMEOUT_MS=30000
MCP_SSE_TIMEOUT_MS=60000
MCP_MAX_SERVERS=50

# RAG / Embedding
RAG_EMBEDDING_MODEL=nomic-embed-text      # Ollama embedding model
RAG_EMBEDDING_DIM=768                       # Must match model output
RAG_CHUNK_SIZE=512                          # Tokens per chunk
RAG_CHUNK_OVERLAP=50                        # Overlap tokens
RAG_SEARCH_TOP_K=5                          # Default vector search limit
RAG_SIMILARITY_THRESHOLD=0.7                # Cosine similarity cutoff
RAG_MAX_CONTEXT_TOKENS=2048                 # Max tokens injected into prompt
```

---

## 5. Docker Compose Update

```yaml
# Add to existing docker-compose.yml
services:
  xclaw:
    # ... existing config
    depends_on:
      postgres:
        condition: service_healthy
      mongodb:
        condition: service_healthy
    environment:
      PG_CONNECTION_STRING: postgresql://xclaw:xclaw@postgres:5432/xclaw
      MONGO_CONNECTION_STRING: mongodb://mongodb:27017/xclaw

  postgres:
    image: postgres:18
    restart: unless-stopped
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
    restart: unless-stopped
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

---

## 6. Testing Strategy

| Level | Tool | Coverage |
|---|---|---|
| Unit tests | Vitest | Services, repositories, encryption |
| Integration tests | Vitest + testcontainers | PG + Mongo operations |
| API tests | Supertest | REST endpoints |
| E2E tests | Manual + MCP Chrome | Full flow UI → DB |

### Key Test Scenarios

1. **Model CRUD** — Create, list, update, soft-delete, ensure UUIDv7 PKs
2. **API Key Encryption** — Encrypt, store, decrypt, verify never in API response
3. **Model Switch** — Switch default, verify temporal constraints, no overlap
4. **Ollama Pull** — Mock pull API, verify progress events, auto-register profile
5. **Benchmark** — Run against Ollama model, verify DB storage, compare results
6. **Usage Tracking** — Log tokens, verify cost_estimate virtual column
7. **Conversation Storage** — Save to Mongo, retrieve, verify flexible schema
8. **Health Check** — Test each provider + DB status
9. **Graceful Degradation** — Kill PG, verify Mongo still works and vice versa
10. **Skill Lifecycle** — Activate, verify tools registered, deactivate, verify cleanup
11. **MCP Register** — Register stdio/sse server, verify tool discovery, bridge names
12. **MCP Toggle** — Enable/disable server, verify tools removed from Agent
13. **MCP Presets** — Install preset by domain, verify server+tools created
14. **MCP Transport** — Test stdio, sse, streamable-http reconnection
15. **Knowledge Ingest** — Upload PDF/MD, verify chunking + embedding stored
16. **Vector Search** — Search chunks, verify cosine similarity + threshold
17. **RAG Context Injection** — Verify buildMessages() includes relevant chunks
18. **Knowledge Deletion** — Delete collection, verify cascade to docs + chunks
19. **Embedding Consistency** — Same text → same embedding, different LLM fallback
20. **RAG Settings** — Change chunk size/overlap, re-ingest, verify new chunks

---

## 7. Risk Management

| Risk | Impact | Mitigation |
|---|---|---|
| PG18 Docker image not available | High | Fallback to postgres:17 (most features available) |
| MongoDB connection overhead | Medium | Connection pooling, lazy connect |
| Ollama API changes | Low | Abstract behind OllamaService |
| API key leak | Critical | AES-256-GCM encryption, never in responses, audit log |
| Slow benchmarks | Low | Timeout configuration, abort capability |
| Disk space for Ollama models | Medium | Pre-check disk space before pull |

---

## 8. Definition of Done

Per Phase:
- [ ] All tasks implemented
- [ ] Unit tests passing
- [ ] No TypeScript errors
- [ ] Documented in code (JSDoc for public APIs)
- [ ] Tested manually via Gateway API

Overall:
- [ ] All 22 skill tools working (12 model + 4 MCP + 6 knowledge)
- [ ] Agent LLM can use tools via natural language
- [ ] PG18 + MongoDB populated with real data
- [ ] MCP servers connectable via stdio/sse/streamable-http
- [ ] RAG pipeline: ingest → chunk → embed → search → inject working end-to-end
- [ ] Knowledge chunks auto-injected into Agent prompt context
- [ ] Web UI functional matching wireframes (models + MCP + knowledge)
- [ ] Docker Compose starts full stack
- [ ] .env.example updated
- [ ] README updated
