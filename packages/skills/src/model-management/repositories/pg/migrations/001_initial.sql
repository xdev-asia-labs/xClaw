-- ============================================================
-- Migration 001: Core tables for Model Management
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- model_profiles: LLM model configurations
CREATE TABLE IF NOT EXISTS model_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    provider        VARCHAR(20) NOT NULL
                    CHECK (provider IN ('ollama', 'openai', 'anthropic', 'google', 'custom')),
    model_id        VARCHAR(200) NOT NULL,
    base_url        VARCHAR(500),
    encrypted_api_key  BYTEA,
    encryption_iv      BYTEA,
    encryption_tag     BYTEA,
    temperature     DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens      INTEGER DEFAULT 4096 CHECK (max_tokens > 0),
    top_p           DECIMAL(3,2) DEFAULT 1.0 CHECK (top_p >= 0 AND top_p <= 1),
    supports_tool_calling  BOOLEAN DEFAULT false,
    supports_vision        BOOLEAN DEFAULT false,
    supports_embedding     BOOLEAN DEFAULT false,
    status          VARCHAR(20) DEFAULT 'available'
                    CHECK (status IN ('available', 'unavailable', 'error', 'pulling')),
    is_default      BOOLEAN DEFAULT false,
    tags            TEXT[] DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT unique_provider_model UNIQUE (provider, model_id)
);

-- provider_configs: Provider-level settings
CREATE TABLE IF NOT EXISTS provider_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        VARCHAR(20) NOT NULL UNIQUE
                    CHECK (provider IN ('ollama', 'openai', 'anthropic', 'google', 'custom')),
    base_url        VARCHAR(500),
    encrypted_api_key  BYTEA,
    encryption_iv      BYTEA,
    encryption_tag     BYTEA,
    settings        JSONB DEFAULT '{}',
    last_health_check   TIMESTAMPTZ,
    health_status       VARCHAR(20) DEFAULT 'unknown'
                        CHECK (health_status IN ('healthy', 'degraded', 'unreachable', 'unknown')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- usage_records: Token usage tracking
CREATE TABLE IF NOT EXISTS usage_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_profile_id UUID NOT NULL REFERENCES model_profiles(id),
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    cost_estimate   DECIMAL(10,6) DEFAULT 0,
    request_type    VARCHAR(20) DEFAULT 'chat'
                    CHECK (request_type IN ('chat', 'completion', 'embedding', 'tool_call')),
    latency_ms      INTEGER,
    session_id      VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- benchmark_results: Benchmark scores
CREATE TABLE IF NOT EXISTS benchmark_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_profile_id UUID NOT NULL REFERENCES model_profiles(id),
    test_type       VARCHAR(30) NOT NULL
                    CHECK (test_type IN ('speed', 'code', 'tool_calling', 'vietnamese', 'context_length', 'full')),
    results         JSONB NOT NULL,
    tokens_per_second    DECIMAL(8,2),
    first_token_ms       INTEGER,
    quality_score        DECIMAL(3,1),
    tool_calling_accuracy DECIMAL(3,2),
    duration_ms     INTEGER,
    hardware_info   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- model_sessions: Active model per session (temporal)
CREATE TABLE IF NOT EXISTS model_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_profile_id UUID NOT NULL REFERENCES model_profiles(id),
    session_id      VARCHAR(100) NOT NULL,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to        TIMESTAMPTZ NOT NULL DEFAULT 'infinity',
    CONSTRAINT no_overlapping_sessions
        EXCLUDE USING gist (
            session_id WITH =,
            tstzrange(valid_from, valid_to) WITH &&
        ),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_log: Change history
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    action          VARCHAR(20) NOT NULL
                    CHECK (action IN ('create', 'update', 'delete', 'switch', 'activate', 'deactivate')),
    old_values      JSONB,
    new_values      JSONB,
    performed_by    VARCHAR(100) DEFAULT 'system',
    session_id      VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_model_profiles_updated_at
    BEFORE UPDATE ON model_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_provider_configs_updated_at
    BEFORE UPDATE ON provider_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
