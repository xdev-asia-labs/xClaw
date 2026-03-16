-- ============================================================
-- Migration 003: MCP + RAG tables & indexes
-- ============================================================

-- mcp_servers: MCP server registrations
CREATE TABLE IF NOT EXISTS mcp_servers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    domain          VARCHAR(30) NOT NULL
                    CHECK (domain IN ('code', 'web', 'data', 'productivity', 'knowledge', 'devops', 'media', 'custom')),
    transport       VARCHAR(20) NOT NULL
                    CHECK (transport IN ('stdio', 'sse', 'streamable-http')),
    command         TEXT,
    url             VARCHAR(500),
    encrypted_env   BYTEA,
    encryption_iv   BYTEA,
    encryption_tag  BYTEA,
    enabled         BOOLEAN DEFAULT true,
    auto_connect    BOOLEAN DEFAULT true,
    status          VARCHAR(20) DEFAULT 'disconnected'
                    CHECK (status IN ('connected', 'connecting', 'disconnected', 'error', 'disabled')),
    last_error      TEXT,
    preset_name     VARCHAR(100),
    last_health_check   TIMESTAMPTZ,
    tool_count          INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT mcp_transport_check CHECK (
        (transport = 'stdio' AND command IS NOT NULL) OR
        (transport IN ('sse', 'streamable-http') AND url IS NOT NULL)
    )
);

-- mcp_tools: Cached tools from MCP servers
CREATE TABLE IF NOT EXISTS mcp_tools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id       UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    tool_name       VARCHAR(200) NOT NULL,
    bridged_name    VARCHAR(250),
    description     TEXT,
    input_schema    JSONB NOT NULL DEFAULT '{}',
    invocation_count INTEGER DEFAULT 0,
    last_invoked_at  TIMESTAMPTZ,
    avg_latency_ms   INTEGER,
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_server_tool UNIQUE (server_id, tool_name)
);

-- rag_configs: RAG pipeline settings per collection
CREATE TABLE IF NOT EXISTS rag_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id       VARCHAR(100) NOT NULL UNIQUE,
    chunk_strategy      VARCHAR(20) DEFAULT 'recursive'
                        CHECK (chunk_strategy IN ('recursive', 'sentence', 'paragraph', 'fixed')),
    chunk_max_tokens    INTEGER DEFAULT 512 CHECK (chunk_max_tokens BETWEEN 64 AND 4096),
    chunk_overlap       INTEGER DEFAULT 50 CHECK (chunk_overlap >= 0),
    embedding_model     VARCHAR(100) DEFAULT 'nomic-embed-text',
    embedding_provider  VARCHAR(20) DEFAULT 'ollama'
                        CHECK (embedding_provider IN ('ollama', 'openai')),
    embedding_dimensions INTEGER DEFAULT 768,
    search_top_k        INTEGER DEFAULT 5 CHECK (search_top_k BETWEEN 1 AND 50),
    score_threshold     DECIMAL(3,2) DEFAULT 0.70 CHECK (score_threshold BETWEEN 0 AND 1),
    auto_inject         BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- rag_query_log: RAG search analytics
CREATE TABLE IF NOT EXISTS rag_query_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text      TEXT NOT NULL,
    query_embedding_model VARCHAR(100),
    collection_ids  TEXT[],
    chunks_retrieved INTEGER NOT NULL DEFAULT 0,
    top_score       DECIMAL(5,4),
    avg_score       DECIMAL(5,4),
    search_latency_ms   INTEGER,
    embed_latency_ms    INTEGER,
    total_latency_ms    INTEGER,
    feedback_score  SMALLINT CHECK (feedback_score BETWEEN 1 AND 5),
    feedback_note   TEXT,
    session_id      VARCHAR(100),
    conversation_id VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MCP Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_servers_domain
    ON mcp_servers (domain, enabled) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_servers_status
    ON mcp_servers (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_tools_server
    ON mcp_tools (server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_bridged_name
    ON mcp_tools (bridged_name);

-- RAG Indexes
CREATE INDEX IF NOT EXISTS idx_rag_query_log_date
    ON rag_query_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_query_log_collection
    ON rag_query_log USING gin (collection_ids);

-- Triggers
CREATE TRIGGER trg_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rag_configs_updated_at
    BEFORE UPDATE ON rag_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
