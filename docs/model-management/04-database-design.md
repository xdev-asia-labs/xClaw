# Database Design
## xClaw Model Management — PostgreSQL 18 + MongoDB
**Version:** 3.0.0  
**Date:** 2026-03-16

---

## 1. Database Strategy

### 1.1 Polyglot Persistence

| Database | Version | Role | Data Characteristics |
|---|---|---|---|
| **PostgreSQL 18** | 18.3 | Structured data | Fixed schema, ACID, relational, aggregation |
| **MongoDB** | 7.x+ | Unstructured data | Flexible schema, documents, embeddings, JSON blobs |

### 1.2 Data Classification

```
┌─────────────────────────┐    ┌─────────────────────────┐
│    PostgreSQL 18         │    │       MongoDB            │
│                          │    │                          │
│  ✅ Model profiles       │    │  ✅ Conversations        │
│  ✅ Provider configs     │    │  ✅ Chat messages        │
│  ✅ Usage records        │    │  ✅ Memory entries       │
│  ✅ Benchmark results    │    │  ✅ Raw LLM responses    │
│  ✅ Model sessions       │    │  ✅ Prompt templates     │
│  ✅ MCP server configs   │    │  ✅ Knowledge collections│
│  ✅ MCP tool cache       │    │  ✅ Knowledge documents  │
│  ✅ RAG pipeline configs │    │  ✅ Knowledge chunks     │
│  ✅ RAG query log        │    │  ✅ Embeddings (vectors) │
│  ✅ Audit log            │    │  ✅ Error logs (JSON)    │
│                          │    │                          │
│  WHY?                    │    │  WHY?                    │
│  • ACID transactions     │    │  • Flexible schema       │
│  • Foreign keys          │    │  • Nested documents      │
│  • SQL aggregation       │    │  • Variable structure    │
│  • Temporal constraints  │    │  • Large JSON blobs      │
│  • Computed columns      │    │  • Vector search         │
│  • Relational joins      │    │  • Document hierarchy    │
└─────────────────────────┘    └─────────────────────────┘
```

---

## 2. PostgreSQL 18 Schema

### 2.1 Extensions & Setup

```sql
-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- For encryption helpers

-- UUID v7 is native in PostgreSQL 18 — no extension needed
-- SELECT uuidv7(); → '019505a3-7c00-7000-8000-000000000001'
```

### 2.2 Table: `model_profiles`

Core table storing LLM model configurations.

```sql
CREATE TABLE model_profiles (
    -- PG18: uuidv7() generates time-sortable UUIDs natively
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    
    -- Basic info
    name            VARCHAR(100) NOT NULL UNIQUE,
    provider        VARCHAR(20) NOT NULL 
                    CHECK (provider IN ('ollama', 'openai', 'anthropic', 'google', 'custom')),
    model_id        VARCHAR(200) NOT NULL,    -- Provider model identifier (e.g., 'qwen2.5:7b')
    base_url        VARCHAR(500),             -- Custom API base URL
    
    -- PG18: Virtual generated column (computed, not stored)
    display_name    VARCHAR(300) GENERATED ALWAYS AS (
        name || ' (' || provider || '/' || model_id || ')'
    ) VIRTUAL,
    
    -- API key (encrypted)
    encrypted_api_key  BYTEA,
    encryption_iv      BYTEA,
    encryption_tag     BYTEA,
    
    -- Parameters
    temperature     DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens      INTEGER DEFAULT 4096 CHECK (max_tokens > 0),
    top_p           DECIMAL(3,2) DEFAULT 1.0 CHECK (top_p >= 0 AND top_p <= 1),
    
    -- Capabilities
    supports_tool_calling  BOOLEAN DEFAULT false,
    supports_vision        BOOLEAN DEFAULT false,
    supports_embedding     BOOLEAN DEFAULT false,
    
    -- Status
    status          VARCHAR(20) DEFAULT 'available' 
                    CHECK (status IN ('available', 'unavailable', 'error', 'pulling')),
    is_default      BOOLEAN DEFAULT false,
    
    -- Metadata
    tags            TEXT[] DEFAULT '{}',
    notes           TEXT,
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,          -- Soft delete
    
    -- Constraints
    CONSTRAINT unique_provider_model UNIQUE (provider, model_id) WHERE deleted_at IS NULL
);

-- Indexes
-- PG18: Skip scan benefits multi-column B-tree indexes
CREATE INDEX idx_model_profiles_provider_status 
    ON model_profiles (provider, status) WHERE deleted_at IS NULL;

CREATE INDEX idx_model_profiles_is_default 
    ON model_profiles (is_default) WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX idx_model_profiles_created_at 
    ON model_profiles (created_at DESC) WHERE deleted_at IS NULL;

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_model_profiles_updated_at
    BEFORE UPDATE ON model_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Ensure only 1 default model
CREATE UNIQUE INDEX idx_single_default 
    ON model_profiles ((true)) WHERE is_default = true AND deleted_at IS NULL;
```

### 2.3 Table: `provider_configs`

Provider-level settings (shared across models of same provider).

```sql
CREATE TABLE provider_configs (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    provider        VARCHAR(20) NOT NULL UNIQUE
                    CHECK (provider IN ('ollama', 'openai', 'anthropic', 'google', 'custom')),
    
    base_url        VARCHAR(500),            -- Default base URL for provider
    
    -- Encrypted default API key
    encrypted_api_key  BYTEA,
    encryption_iv      BYTEA,
    encryption_tag     BYTEA,
    
    -- Provider-specific settings (JSONB for flexibility)
    settings        JSONB DEFAULT '{}',
    
    -- Health status
    last_health_check   TIMESTAMPTZ,
    health_status       VARCHAR(20) DEFAULT 'unknown'
                        CHECK (health_status IN ('healthy', 'degraded', 'unreachable', 'unknown')),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_provider_configs_updated_at
    BEFORE UPDATE ON provider_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.4 Table: `usage_records`

Token usage tracking per request.

```sql
CREATE TABLE usage_records (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    model_profile_id UUID NOT NULL REFERENCES model_profiles(id),
    
    -- Token counts
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    
    -- PG18: Virtual generated column for estimated cost
    -- Cost per 1M tokens: OpenAI GPT-4o-mini = $0.15 input / $0.60 output
    cost_estimate   DECIMAL(10,6) GENERATED ALWAYS AS (
        CASE 
            WHEN (SELECT provider FROM model_profiles WHERE id = model_profile_id) = 'ollama' THEN 0
            WHEN (SELECT provider FROM model_profiles WHERE id = model_profile_id) = 'openai' THEN
                (prompt_tokens * 0.00000015) + (completion_tokens * 0.0000006)
            WHEN (SELECT provider FROM model_profiles WHERE id = model_profile_id) = 'anthropic' THEN
                (prompt_tokens * 0.00000025) + (completion_tokens * 0.00000125)
            ELSE 0
        END
    ) VIRTUAL,
    
    -- Request metadata
    request_type    VARCHAR(20) DEFAULT 'chat'
                    CHECK (request_type IN ('chat', 'completion', 'embedding', 'tool_call')),
    latency_ms      INTEGER,
    
    -- Session reference
    session_id      VARCHAR(100),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage aggregation queries
CREATE INDEX idx_usage_model_date 
    ON usage_records (model_profile_id, created_at DESC);

CREATE INDEX idx_usage_date 
    ON usage_records (created_at DESC);

CREATE INDEX idx_usage_session 
    ON usage_records (session_id) WHERE session_id IS NOT NULL;

-- Partitioning by month for performance (optional, for high-volume)
-- CREATE TABLE usage_records_2026_03 PARTITION OF usage_records
--     FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

### 2.5 Table: `benchmark_results`

Benchmark test results.

```sql
CREATE TABLE benchmark_results (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    model_profile_id UUID NOT NULL REFERENCES model_profiles(id),
    
    -- Test results (JSONB for flexibility)
    test_type       VARCHAR(30) NOT NULL
                    CHECK (test_type IN ('speed', 'code', 'tool_calling', 'vietnamese', 'context_length', 'full')),
    results         JSONB NOT NULL,
    
    -- Summary scores
    tokens_per_second    DECIMAL(8,2),
    first_token_ms       INTEGER,
    quality_score        DECIMAL(3,1),      -- 0.0 to 10.0
    tool_calling_accuracy DECIMAL(3,2),     -- 0.00 to 1.00
    
    -- Metadata
    duration_ms     INTEGER,
    hardware_info   JSONB,                  -- CPU, RAM snapshot at benchmark time
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PG18: Skip scan index for multi-column queries
CREATE INDEX idx_benchmarks_model_type 
    ON benchmark_results (model_profile_id, test_type, created_at DESC);
```

### 2.6 Table: `model_sessions`

Track which model is active per session, with temporal constraints.

```sql
CREATE TABLE model_sessions (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    model_profile_id UUID NOT NULL REFERENCES model_profiles(id),
    session_id      VARCHAR(100) NOT NULL,  -- 'default' for global, or specific session ID
    
    -- PG18: Temporal columns for WITHOUT OVERLAPS constraint
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to        TIMESTAMPTZ NOT NULL DEFAULT 'infinity',
    
    -- PG18: Temporal constraint — no overlapping sessions for same session_id
    CONSTRAINT no_overlapping_sessions 
        EXCLUDE USING gist (
            session_id WITH =,
            tstzrange(valid_from, valid_to) WITH &&
        ),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Need btree_gist extension for the exclude constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX idx_model_sessions_active 
    ON model_sessions (session_id, valid_from DESC) 
    WHERE valid_to = 'infinity';
```

### 2.7 Table: `audit_log`

Change history for model configs.

```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    entity_type     VARCHAR(50) NOT NULL,     -- 'model_profile', 'provider_config'
    entity_id       UUID NOT NULL,
    action          VARCHAR(20) NOT NULL       -- 'create', 'update', 'delete', 'switch'
                    CHECK (action IN ('create', 'update', 'delete', 'switch', 'activate', 'deactivate')),
    
    -- PG18: OLD/NEW values captured via RETURNING
    old_values      JSONB,
    new_values      JSONB,
    
    -- Context
    performed_by    VARCHAR(100) DEFAULT 'system',
    session_id      VARCHAR(100),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity 
    ON audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX idx_audit_date 
    ON audit_log (created_at DESC);
```

### 2.8 Table: `mcp_servers`

MCP server registrations organized by domain (chuyên đề).

```sql
CREATE TABLE mcp_servers (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    
    -- Identity
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    domain          VARCHAR(30) NOT NULL
                    CHECK (domain IN ('code', 'web', 'data', 'productivity', 'knowledge', 'devops', 'media', 'custom')),
    
    -- Connection config
    transport       VARCHAR(20) NOT NULL
                    CHECK (transport IN ('stdio', 'sse', 'streamable-http')),
    command         TEXT,                     -- stdio: "npx -y @modelcontextprotocol/server-github"
    url             VARCHAR(500),             -- SSE/HTTP: "http://localhost:3001/mcp"
    
    -- Environment variables (encrypted — same AES-256-GCM as API keys)
    encrypted_env   BYTEA,                    -- JSON { "GITHUB_TOKEN": "ghp_..." } encrypted
    encryption_iv   BYTEA,
    encryption_tag  BYTEA,
    
    -- State
    enabled         BOOLEAN DEFAULT true,
    auto_connect    BOOLEAN DEFAULT true,
    status          VARCHAR(20) DEFAULT 'disconnected'
                    CHECK (status IN ('connected', 'connecting', 'disconnected', 'error', 'disabled')),
    last_error      TEXT,
    
    -- Preset info (null if custom)
    preset_name     VARCHAR(100),             -- e.g., "GitHub" from mcp-presets.ts
    
    -- Health
    last_health_check   TIMESTAMPTZ,
    tool_count          INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT mcp_transport_check CHECK (
        (transport = 'stdio' AND command IS NOT NULL) OR
        (transport IN ('sse', 'streamable-http') AND url IS NOT NULL)
    )
);

CREATE INDEX idx_mcp_servers_domain 
    ON mcp_servers (domain, enabled) WHERE deleted_at IS NULL;

CREATE INDEX idx_mcp_servers_status 
    ON mcp_servers (status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.9 Table: `mcp_tools`

Cached tools discovered from MCP servers (refreshed on connect).

```sql
CREATE TABLE mcp_tools (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    server_id       UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    
    -- Tool identity
    tool_name       VARCHAR(200) NOT NULL,                -- Original name from server
    bridged_name    VARCHAR(250) GENERATED ALWAYS AS (    -- PG18 virtual generated column
        'mcp_' || LOWER(REPLACE((SELECT name FROM mcp_servers WHERE id = server_id), ' ', '_')) || '_' || tool_name
    ) VIRTUAL,
    description     TEXT,
    
    -- Input schema (JSON Schema from MCP server)
    input_schema    JSONB NOT NULL DEFAULT '{}',
    
    -- Usage stats
    invocation_count INTEGER DEFAULT 0,
    last_invoked_at  TIMESTAMPTZ,
    avg_latency_ms   INTEGER,
    
    -- Cache metadata
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_server_tool UNIQUE (server_id, tool_name)
);

CREATE INDEX idx_mcp_tools_server 
    ON mcp_tools (server_id);

CREATE INDEX idx_mcp_tools_bridged_name 
    ON mcp_tools (bridged_name);
```

### 2.10 Table: `rag_configs`

RAG pipeline settings per knowledge collection.

```sql
CREATE TABLE rag_configs (
    id                  UUID PRIMARY KEY DEFAULT uuidv7(),
    collection_id       VARCHAR(100) NOT NULL UNIQUE,     -- refs MongoDB knowledge_collections._id
    
    -- Chunking config
    chunk_strategy      VARCHAR(20) DEFAULT 'recursive'
                        CHECK (chunk_strategy IN ('recursive', 'sentence', 'paragraph', 'fixed')),
    chunk_max_tokens    INTEGER DEFAULT 512 CHECK (chunk_max_tokens BETWEEN 64 AND 4096),
    chunk_overlap       INTEGER DEFAULT 50 CHECK (chunk_overlap >= 0),
    
    -- Embedding config
    embedding_model     VARCHAR(100) DEFAULT 'nomic-embed-text',
    embedding_provider  VARCHAR(20) DEFAULT 'ollama'
                        CHECK (embedding_provider IN ('ollama', 'openai')),
    embedding_dimensions INTEGER DEFAULT 768,
    
    -- Search config
    search_top_k        INTEGER DEFAULT 5 CHECK (search_top_k BETWEEN 1 AND 50),
    score_threshold     DECIMAL(3,2) DEFAULT 0.70 CHECK (score_threshold BETWEEN 0 AND 1),
    
    -- Auto-inject into agent prompt
    auto_inject         BOOLEAN DEFAULT true,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rag_configs_updated_at
    BEFORE UPDATE ON rag_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.11 Table: `rag_query_log`

RAG search analytics — tracks what users search and retrieval quality.

```sql
CREATE TABLE rag_query_log (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    
    -- Query info
    query_text      TEXT NOT NULL,
    query_embedding_model VARCHAR(100),
    
    -- Results summary
    collection_ids  TEXT[],                   -- Collections searched
    chunks_retrieved INTEGER NOT NULL DEFAULT 0,
    top_score       DECIMAL(5,4),
    avg_score       DECIMAL(5,4),
    
    -- Performance
    search_latency_ms   INTEGER,
    embed_latency_ms    INTEGER,
    total_latency_ms    INTEGER,
    
    -- Feedback (optional — user can rate RAG quality)
    feedback_score  SMALLINT CHECK (feedback_score BETWEEN 1 AND 5),
    feedback_note   TEXT,
    
    -- Context
    session_id      VARCHAR(100),
    conversation_id VARCHAR(100),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rag_query_log_date 
    ON rag_query_log (created_at DESC);

CREATE INDEX idx_rag_query_log_collection 
    ON rag_query_log USING gin (collection_ids);
```

---

## 3. MongoDB Collections

### 3.1 Collection: `conversations`

Chat sessions with full message history.

```javascript
// Document structure
{
  _id: ObjectId("..."),
  conversationId: "conv_019505a3...",    // Custom ID
  title: "Debug TypeScript Error",
  
  // Reference to PG model (UUID string)
  modelProfileId: "019505a3-7c00-7000-8000-000000000001",
  modelName: "Qwen 2.5 7B",
  provider: "ollama",
  
  // Messages array — flexible schema per provider
  messages: [
    {
      role: "user",
      content: "Fix this TypeScript error",
      timestamp: ISODate("2026-03-16T10:00:00Z"),
    },
    {
      role: "assistant", 
      content: "I see the issue...",
      // Provider-specific fields (only exists for some providers)
      toolCalls: [
        {
          id: "call_abc123",
          type: "function",
          function: { name: "file_read", arguments: '{"path":"src/index.ts"}' }
        }
      ],
      // Anthropic-specific
      contentBlocks: null,
      // Usage info
      usage: { promptTokens: 150, completionTokens: 200 },
      timestamp: ISODate("2026-03-16T10:00:05Z"),
    },
    {
      role: "tool",
      toolCallId: "call_abc123",
      content: "// file contents...",
      timestamp: ISODate("2026-03-16T10:00:06Z"),
    }
  ],
  
  // Metadata
  messageCount: 12,
  totalTokens: 5000,
  tags: ["typescript", "debugging"],
  
  createdAt: ISODate("2026-03-16T10:00:00Z"),
  lastMessageAt: ISODate("2026-03-16T10:30:00Z"),
  deletedAt: null
}
```

**Indexes:**
```javascript
db.conversations.createIndex({ conversationId: 1 }, { unique: true });
db.conversations.createIndex({ modelProfileId: 1, lastMessageAt: -1 });
db.conversations.createIndex({ createdAt: -1 });
db.conversations.createIndex({ tags: 1 });
db.conversations.createIndex({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: null } });
```

**Why MongoDB?**
- Messages have different structures per provider (OpenAI có `tool_calls`, Anthropic có `content_blocks`, Ollama có `context`)
- Nested arrays of messages with sub-documents
- Easy to add new message types (images, files, etc.)
- No need for JOIN — conversation is self-contained document

---

### 3.2 Collection: `memory_entries`

Agent memory for RAG and context.

```javascript
{
  _id: ObjectId("..."),
  type: "fact",                           // fact, conversation_summary, user_preference
  content: "User prefers TypeScript over JavaScript",
  
  // Embedding vector for similarity search
  embedding: [0.0123, -0.0456, 0.0789, ...],  // float array (1536 dimensions for OpenAI, 384 for Ollama)
  embeddingModel: "qwen2.5:7b",
  
  // Metadata (flexible)
  metadata: {
    source: "conversation",
    conversationId: "conv_019505a3...",
    importance: 0.85,
    lastAccessed: ISODate("2026-03-16T10:00:00Z"),
    accessCount: 5,
    tags: ["typescript", "preference"]
  },
  
  createdAt: ISODate("2026-03-16T10:00:00Z"),
  updatedAt: ISODate("2026-03-16T12:00:00Z"),
  expiresAt: null                         // TTL or null for permanent
}
```

**Indexes:**
```javascript
db.memory_entries.createIndex({ type: 1, createdAt: -1 });
db.memory_entries.createIndex({ "metadata.tags": 1 });
db.memory_entries.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Vector search index (for MongoDB Atlas or local search)
// If using MongoDB Atlas:
// db.memory_entries.createSearchIndex({
//   name: "vector_index",
//   definition: {
//     mappings: {
//       dynamic: true,
//       fields: {
//         embedding: { type: "knnVector", dimensions: 1536, similarity: "cosine" }
//       }
//     }
//   }
// });
```

**Why MongoDB?**
- Embeddings are large float arrays — natural fit for document storage
- Metadata varies wildly (different sources, different fields)
- Vector search support (Atlas or local approximation)
- Flexible TTL for auto-cleanup

---

### 3.3 Collection: `llm_responses`

Raw LLM API responses for debugging and audit.

```javascript
{
  _id: ObjectId("..."),
  
  // Request info
  modelProfileId: "019505a3-...",
  provider: "openai",
  modelId: "gpt-4o-mini",
  
  // Full request (sanitized — no API key)
  request: {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "..." }],
    tools: [...],
    temperature: 0.7,
    max_tokens: 4096
  },
  
  // Full response (raw JSON from provider)
  response: {
    id: "chatcmpl-abc123",
    object: "chat.completion",
    choices: [{
      message: { role: "assistant", content: "..." },
      finish_reason: "stop"
    }],
    usage: { prompt_tokens: 150, completion_tokens: 200, total_tokens: 350 }
  },
  
  // Performance
  latencyMs: 1234,
  statusCode: 200,
  
  // Context
  conversationId: "conv_019505a3...",
  sessionId: "session_abc",
  
  createdAt: ISODate("2026-03-16T10:00:05Z"),
  
  // Auto-delete after 30 days
  expiresAt: ISODate("2026-04-15T10:00:05Z")
}
```

**Indexes:**
```javascript
db.llm_responses.createIndex({ modelProfileId: 1, createdAt: -1 });
db.llm_responses.createIndex({ conversationId: 1 });
db.llm_responses.createIndex({ statusCode: 1 }, { partialFilterExpression: { statusCode: { $ne: 200 } } });
db.llm_responses.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

**Why MongoDB?**
- Each provider returns completely different JSON structures
- Response payloads can be very large (10KB+)
- Schema changes whenever provider updates their API
- TTL auto-cleanup for storage management

---

### 3.4 Collection: `prompt_templates`

Reusable prompt templates.

```javascript
{
  _id: ObjectId("..."),
  templateId: "tmpl_code_review",
  name: "Code Review",
  description: "Review code for bugs, style, and best practices",
  category: "programming",
  
  // Template with variables
  template: "Review the following {{language}} code for:\n1. Bugs\n2. Style issues\n3. Best practices\n\nCode:\n```{{language}}\n{{code}}\n```",
  
  // Variable definitions
  variables: [
    { name: "language", type: "string", required: true, default: "typescript" },
    { name: "code", type: "string", required: true }
  ],
  
  // System prompt override
  systemPrompt: "You are a senior code reviewer with expertise in {{language}}.",
  
  // Versioning
  version: 2,
  versions: [
    { version: 1, template: "...", createdAt: ISODate("2026-03-01") },
    { version: 2, template: "...", createdAt: ISODate("2026-03-15") }
  ],
  
  // Metadata
  tags: ["code", "review", "programming"],
  usageCount: 42,
  
  createdAt: ISODate("2026-03-01T10:00:00Z"),
  updatedAt: ISODate("2026-03-15T10:00:00Z")
}
```

**Why MongoDB?**
- Nested versioning (array of historical versions)
- Variable definitions are flexible structures
- Template content can be very long
- Categories and tags for browsing

---

### 3.5 Collection: `knowledge_collections`

Knowledge base groupings (like folders for RAG documents).

```javascript
{
  _id: ObjectId("..."),
  collectionId: "coll_019505a3...",        // Custom ID
  name: "xClaw Documentation",
  description: "Official xClaw docs and guides",
  
  // Stats (auto-updated on document add/remove)
  documentCount: 15,
  chunkCount: 342,
  totalTokens: 175000,
  totalSizeBytes: 2500000,
  
  // RAG config reference (detailed config in PG18 rag_configs table)
  embeddingModel: "nomic-embed-text",
  embeddingDimensions: 768,
  chunkConfig: {
    strategy: "recursive",
    maxTokens: 512,
    overlap: 50
  },
  
  // Metadata
  tags: ["documentation", "xclaw"],
  
  createdAt: ISODate("2026-03-16T10:00:00Z"),
  updatedAt: ISODate("2026-03-16T14:00:00Z"),
  deletedAt: null
}
```

**Indexes:**
```javascript
db.knowledge_collections.createIndex({ collectionId: 1 }, { unique: true });
db.knowledge_collections.createIndex({ name: 1 }, { unique: true });
db.knowledge_collections.createIndex({ tags: 1 });
db.knowledge_collections.createIndex({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: null } });
```

**Why MongoDB?** Flexible per-collection config (different chunk strategies, embedding models). Stats counters updated atomically with `$inc`.

---

### 3.6 Collection: `knowledge_documents`

Original uploaded documents (before chunking).

```javascript
{
  _id: ObjectId("..."),
  documentId: "doc_019505a3...",           // Custom ID
  collectionId: "coll_019505a3...",        // Parent collection
  
  // Source info
  name: "README.md",
  source: "file",                           // "file" | "text" | "url"
  mimeType: "text/markdown",
  originalUrl: null,                        // For URL sources
  
  // Content (raw text after parsing)
  content: "# xClaw\n\nxClaw is an AI Agent platform...",
  contentHash: "sha256:abc123...",          // Dedup check
  sizeBytes: 4096,
  
  // Ingestion status
  status: "ready",                          // "pending" | "processing" | "ready" | "error"
  chunkCount: 8,
  error: null,
  
  // Processing metadata
  parsedAt: ISODate("2026-03-16T10:01:00Z"),
  chunkedAt: ISODate("2026-03-16T10:01:10Z"),
  embeddedAt: ISODate("2026-03-16T10:01:30Z"),
  
  createdAt: ISODate("2026-03-16T10:00:00Z"),
  updatedAt: ISODate("2026-03-16T10:01:30Z"),
  deletedAt: null
}
```

**Indexes:**
```javascript
db.knowledge_documents.createIndex({ documentId: 1 }, { unique: true });
db.knowledge_documents.createIndex({ collectionId: 1, createdAt: -1 });
db.knowledge_documents.createIndex({ status: 1 });
db.knowledge_documents.createIndex({ contentHash: 1 });  // Dedup
db.knowledge_documents.createIndex({ deletedAt: 1 }, { partialFilterExpression: { deletedAt: null } });
```

**Why MongoDB?** Variable source types (file vs URL), large content blobs, flexible metadata per source type.

---

### 3.7 Collection: `knowledge_chunks`

Chunked text pieces with embedding vectors — core of RAG vector search.

```javascript
{
  _id: ObjectId("..."),
  chunkId: "chunk_019505a3...",
  documentId: "doc_019505a3...",           // Parent document
  collectionId: "coll_019505a3...",        // Parent collection (denormalized for query performance)
  
  // Content
  content: "# xClaw\n\nxClaw is an AI Agent platform that enables...",
  index: 0,                                 // Chunk order within document
  tokenCount: 487,
  
  // Embedding vector — THE KEY FIELD for vector search
  embedding: [0.0123, -0.0456, 0.0789, ...],  // float[768] for nomic-embed-text
  embeddingModel: "nomic-embed-text",
  
  // Position in original document
  startOffset: 0,                           // Character offset in original content
  endOffset: 2048,
  
  createdAt: ISODate("2026-03-16T10:01:20Z")
}
```

**Indexes:**
```javascript
db.knowledge_chunks.createIndex({ chunkId: 1 }, { unique: true });
db.knowledge_chunks.createIndex({ documentId: 1, index: 1 });
db.knowledge_chunks.createIndex({ collectionId: 1 });

// ★ Vector Search Index — THE CRITICAL INDEX for RAG
// Option A: MongoDB Atlas Vector Search (production)
db.knowledge_chunks.createSearchIndex({
  name: "chunk_vector_index",
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: 768,
        similarity: "cosine"
      },
      {
        type: "filter",
        path: "collectionId"
      }
    ]
  }
});

// Option B: Local development (approximate search using $nearSphere workaround)
// Or use in-memory cosine similarity from MemoryManager.cosineSim()
// which is already implemented in packages/core/src/memory/memory-manager.ts
```

**Why MongoDB?** 
- Embedding vectors are large float arrays (768-3072 dimensions)
- Native `$vectorSearch` aggregation for semantic search
- Denormalized collectionId for filtered search without joins
- Document model matches the chunk's self-contained nature

**Vector Search Query:**
```javascript
// Production (MongoDB Atlas):
db.knowledge_chunks.aggregate([
  {
    $vectorSearch: {
      index: "chunk_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,      // float[768] from embed(userQuery)
      numCandidates: 100,
      limit: 5,
      filter: { collectionId: "coll_019505a3..." }
    }
  },
  {
    $project: {
      content: 1,
      documentId: 1,
      collectionId: 1,
      index: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
]);

// Development (in-app cosine similarity fallback):
// Load chunks for collection → compute cosineSim(queryVec, chunk.embedding) → sort → top-K
```

---

## 4. ERD — PostgreSQL 18

```
┌─────────────────────┐       ┌─────────────────────┐
│   model_profiles     │       │  provider_configs    │
├─────────────────────┤       ├─────────────────────┤
│ id (PK, uuidv7)    │       │ id (PK, uuidv7)    │
│ name (UNIQUE)       │◄──┐  │ provider (UNIQUE)   │
│ provider            │   │  │ base_url            │
│ model_id            │   │  │ encrypted_api_key   │
│ display_name (VGC)  │   │  │ settings (JSONB)    │
│ encrypted_api_key   │   │  │ health_status       │
│ temperature         │   │  └─────────────────────┘
│ max_tokens          │   │
│ supports_tool_call  │   │
│ status              │   │
│ is_default          │   │
│ created_at          │   │
│ updated_at          │   │
│ deleted_at          │   │
└─────────┬───────────┘   │
          │               │
          │ 1:N           │
          ▼               │
┌─────────────────────┐   │  ┌─────────────────────┐
│   usage_records      │   │  │  benchmark_results   │
├─────────────────────┤   │  ├─────────────────────┤
│ id (PK, uuidv7)    │   │  │ id (PK, uuidv7)    │
│ model_profile_id(FK)│───┘  │ model_profile_id(FK)│
│ prompt_tokens       │      │ test_type           │
│ completion_tokens   │      │ results (JSONB)     │
│ total_tokens        │      │ tokens_per_second   │
│ cost_estimate (VGC) │      │ quality_score       │
│ request_type        │      │ duration_ms         │
│ latency_ms          │      │ hardware_info       │
│ session_id          │      │ created_at          │
│ created_at          │      └─────────────────────┘
└─────────────────────┘
                             ┌─────────────────────┐
┌─────────────────────┐      │    audit_log         │
│   model_sessions     │      ├─────────────────────┤
├─────────────────────┤      │ id (PK, uuidv7)    │
│ id (PK, uuidv7)    │      │ entity_type         │
│ model_profile_id(FK)│      │ entity_id           │
│ session_id          │      │ action              │
│ valid_from          │      │ old_values (JSONB)  │
│ valid_to            │      │ new_values (JSONB)  │
│ EXCLUDE (temporal)  │      │ performed_by        │
│ created_at          │      │ created_at          │
└─────────────────────┘      └─────────────────────┘

┌─────────────────────┐      ┌─────────────────────┐
│   mcp_servers        │      │    mcp_tools         │
├─────────────────────┤      ├─────────────────────┤
│ id (PK, uuidv7)    │←─┐   │ id (PK, uuidv7)    │
│ name (UNIQUE)       │  └───│ server_id (FK)      │
│ domain              │      │ tool_name           │
│ transport           │      │ bridged_name (VGC)  │
│ command / url       │      │ description         │
│ encrypted_env       │      │ input_schema (JSONB)│
│ enabled / status    │      │ invocation_count    │
│ tool_count          │      │ discovered_at       │
│ created_at          │      └─────────────────────┘
└─────────────────────┘

┌─────────────────────┐      ┌─────────────────────┐
│   rag_configs        │      │   rag_query_log      │
├─────────────────────┤      ├─────────────────────┤
│ id (PK, uuidv7)    │      │ id (PK, uuidv7)    │
│ collection_id       │      │ query_text          │
│ chunk_strategy      │      │ chunks_retrieved    │
│ chunk_max_tokens    │      │ top_score / avg     │
│ embedding_model     │      │ search_latency_ms   │
│ search_top_k        │      │ feedback_score      │
│ score_threshold     │      │ session_id          │
│ auto_inject         │      │ created_at          │
└─────────────────────┘      └─────────────────────┘

VGC = Virtual Generated Column (PG18 feature)
```

---

## 5. Cross-Database References

PostgreSQL and MongoDB reference each other via string IDs:

```
PostgreSQL 18                        MongoDB
┌──────────────┐                    ┌──────────────────┐
│model_profiles│    UUID string     │  conversations    │
│  id (UUID)   │◄───────────────────│  modelProfileId  │
└──────────────┘                    └──────────────────┘
                                    ┌──────────────────┐
                    UUID string     │  llm_responses    │
               ◄────────────────────│  modelProfileId  │
                                    └──────────────────┘
┌──────────────┐                    ┌──────────────────┐
│ rag_configs  │  collection_id     │knowledge_         │
│collection_id │───────────────────▶│collections        │
│              │    (string ref)    │  collectionId     │
└──────────────┘                    └──────────────────┘
                                    ┌──────────────────┐
┌──────────────┐                    │knowledge_chunks   │
│ rag_query_log│    string refs     │  collectionId     │
│collection_ids│───────────────────▶│  documentId       │
└──────────────┘                    └──────────────────┘
```

**Rules:**
- MongoDB stores PG UUIDs as strings (not ObjectId)
- No cross-database JOINs — application-level joins only
- PG is source of truth for model identity
- MongoDB data can be rebuilt from raw logs if needed

---

## 6. Migration Strategy

### 6.1 PostgreSQL Migrations

```
packages/skills/src/model-management/repositories/pg/migrations/
├── 001_initial.sql       # Create all tables, extensions
├── 002_indexes.sql       # Create all indexes
├── 003_mcp_rag.sql       # MCP servers/tools + RAG configs/query_log tables
├── 004_seed_data.sql     # Auto-import from .env + MCP presets
└── migrations.ts         # Migration runner
```

**Migration runner** — simple sequential execution:
```typescript
async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  
  // Read migration files, execute in order, record in _migrations
}
```

### 6.2 MongoDB Index Creation

Indexes created during skill activation:
```typescript
async function createMongoIndexes(db: Db): Promise<void> {
  // conversations
  await db.collection('conversations').createIndexes([...]);
  // memory_entries
  await db.collection('memory_entries').createIndexes([...]);
  // llm_responses
  await db.collection('llm_responses').createIndexes([...]);
  // prompt_templates
  await db.collection('prompt_templates').createIndexes([...]);
  // knowledge_collections
  await db.collection('knowledge_collections').createIndexes([...]);
  // knowledge_documents
  await db.collection('knowledge_documents').createIndexes([...]);
  // knowledge_chunks (+ vector search index)
  await db.collection('knowledge_chunks').createIndexes([...]);
  // Create vector search index for RAG
  await db.collection('knowledge_chunks').createSearchIndex({
    name: 'chunk_vector_index',
    type: 'vectorSearch',
    definition: { /* see section 3.7 */ }
  });
}
```

---

## 7. Query Examples

### 7.1 PostgreSQL 18

```sql
-- List available models (skip scan on provider+status index)
SELECT id, name, provider, model_id, display_name, status, is_default
FROM model_profiles
WHERE deleted_at IS NULL
ORDER BY is_default DESC, created_at DESC;

-- Usage report with virtual cost column
SELECT 
    mp.name,
    COUNT(*) as requests,
    SUM(ur.total_tokens) as total_tokens,
    SUM(ur.cost_estimate) as total_cost
FROM usage_records ur
JOIN model_profiles mp ON mp.id = ur.model_profile_id
WHERE ur.created_at >= NOW() - INTERVAL '30 days'
GROUP BY mp.name
ORDER BY total_tokens DESC;

-- Get active model with temporal query
SELECT mp.*
FROM model_sessions ms
JOIN model_profiles mp ON mp.id = ms.model_profile_id
WHERE ms.session_id = 'default'
  AND ms.valid_from <= NOW()
  AND ms.valid_to > NOW()
ORDER BY ms.valid_from DESC
LIMIT 1;

-- Switch model: close current, open new (temporal)
UPDATE model_sessions SET valid_to = NOW()
WHERE session_id = 'default' AND valid_to = 'infinity'
RETURNING OLD.model_profile_id as previous_model;

INSERT INTO model_sessions (model_profile_id, session_id, valid_from, valid_to)
VALUES ($1, 'default', NOW(), 'infinity');

-- Audit log with OLD/NEW RETURNING (PG18)
UPDATE model_profiles 
SET temperature = $2, updated_at = NOW()
WHERE id = $1
RETURNING 
    id,
    (SELECT row_to_json(old.*) FROM (SELECT temperature FROM model_profiles WHERE id = $1) old) as old_values,
    row_to_json(model_profiles.*) as new_values;

-- MCP: List servers by domain with tool counts
SELECT ms.*, 
       COUNT(mt.id) as discovered_tools
FROM mcp_servers ms
LEFT JOIN mcp_tools mt ON mt.server_id = ms.id
WHERE ms.deleted_at IS NULL
GROUP BY ms.id
ORDER BY ms.domain, ms.name;

-- MCP: Get all tools bridged from a specific domain
SELECT mt.bridged_name, mt.description, ms.name as server_name
FROM mcp_tools mt
JOIN mcp_servers ms ON ms.id = mt.server_id
WHERE ms.domain = $1 AND ms.enabled = true AND ms.deleted_at IS NULL;

-- RAG: Search analytics — top queries last 7 days
SELECT query_text, 
       COUNT(*) as search_count,
       AVG(top_score) as avg_top_score,
       AVG(search_latency_ms) as avg_latency
FROM rag_query_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY query_text
ORDER BY search_count DESC
LIMIT 20;
```

### 7.2 MongoDB

```javascript
// Get conversation with messages
db.conversations.findOne({ conversationId: "conv_019505a3..." });

// Search memory entries by tag
db.memory_entries.find({ 
  "metadata.tags": "typescript",
  type: "fact"
}).sort({ "metadata.importance": -1 }).limit(10);

// Count tokens per model (last 30 days)
db.llm_responses.aggregate([
  { $match: { createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } },
  { $group: { 
    _id: "$modelProfileId",
    totalRequests: { $sum: 1 },
    avgLatency: { $avg: "$latencyMs" },
    errors: { $sum: { $cond: [{ $ne: ["$statusCode", 200] }, 1, 0] } }
  }},
  { $sort: { totalRequests: -1 } }
]);

// Vector similarity search (if using Atlas)
// db.memory_entries.aggregate([
//   { $vectorSearch: {
//     index: "vector_index",
//     path: "embedding",
//     queryVector: [...],
//     numCandidates: 100,
//     limit: 10
//   }}
// ]);

// RAG: Semantic search across knowledge chunks
db.knowledge_chunks.aggregate([
  {
    $vectorSearch: {
      index: "chunk_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,    // float[768]
      numCandidates: 100,
      limit: 5,
      filter: { collectionId: "coll_019505a3..." }
    }
  },
  {
    $project: {
      content: 1, documentId: 1, collectionId: 1, index: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
]);

// RAG: Collection stats (documents + chunks)
db.knowledge_collections.aggregate([
  { $match: { deletedAt: null } },
  { $lookup: {
    from: "knowledge_documents",
    localField: "collectionId",
    foreignField: "collectionId",
    as: "docs"
  }},
  { $project: {
    name: 1,
    documentCount: { $size: "$docs" },
    readyDocs: { $size: { $filter: { input: "$docs", cond: { $eq: ["$$this.status", "ready"] } } } },
    totalSize: { $sum: "$docs.sizeBytes" }
  }}
]);

// RAG: Check for duplicate document (by content hash)
db.knowledge_documents.findOne({
  collectionId: "coll_019505a3...",
  contentHash: "sha256:abc123...",
  deletedAt: null
});
```

---

## 8. Backup & Recovery

| Database | Strategy | Frequency |
|---|---|---|
| PostgreSQL 18 | `pg_dump --format=custom` | Daily |
| MongoDB | `mongodump --gzip` | Daily |
| Both | Docker volume snapshots | Before upgrades |

```bash
# PostgreSQL 18 backup
pg_dump -U xclaw -h localhost -Fc xclaw > backup_pg_$(date +%Y%m%d).dump

# MongoDB backup
mongodump --host localhost --port 27017 --db xclaw --gzip --out backup_mongo_$(date +%Y%m%d)
```
