-- Migration 005: Admin RBAC + Channel Config + API Keys + Memory Habits
-- Adds admin/user role enforcement, channel configuration persistence,
-- API keys for embeddable chat, and user memory/habit tracking.

-- ─── Channel Configurations ────────────────────────────────
-- Stores bot tokens, webhook URLs, etc. for each channel plugin
CREATE TABLE IF NOT EXISTS channel_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        VARCHAR(30) NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT false,
    config          JSONB NOT NULL DEFAULT '{}',
    encrypted_token BYTEA,
    encryption_iv   BYTEA,
    encryption_tag  BYTEA,
    status          VARCHAR(20) DEFAULT 'disconnected'
                    CHECK (status IN ('connected', 'disconnected', 'error')),
    last_connected_at TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── API Keys for embeddable chat widget ────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    key_prefix      VARCHAR(10) NOT NULL,
    key_hash        TEXT NOT NULL,
    scopes          TEXT[] DEFAULT '{chat}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── User Memory / Habits ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL DEFAULT 'fact'
                    CHECK (type IN ('fact', 'preference', 'habit', 'context', 'instruction')),
    content         TEXT NOT NULL,
    tags            TEXT[] DEFAULT '{}',
    weight          DECIMAL(3,2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 5),
    source          VARCHAR(30) DEFAULT 'user'
                    CHECK (source IN ('user', 'system', 'auto')),
    hit_count       INTEGER DEFAULT 0,
    last_hit_at     TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Weighted Scoring Test Data ─────────────────────────────
CREATE TABLE IF NOT EXISTS scoring_tests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    model_id        UUID REFERENCES model_profiles(id),
    test_input      TEXT NOT NULL,
    expected_output TEXT,
    actual_output   TEXT,
    scores          JSONB DEFAULT '{}',
    overall_score   DECIMAL(5,2),
    weights         JSONB DEFAULT '{"relevance": 0.3, "accuracy": 0.3, "fluency": 0.2, "safety": 0.2}',
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    run_by          UUID REFERENCES users(id),
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_channel_configs_platform ON channel_configs(platform);
CREATE INDEX idx_api_keys_user ON api_keys(user_id) WHERE is_active;
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_user_memories_user ON user_memories(user_id, type) WHERE is_active;
CREATE INDEX idx_user_memories_tags ON user_memories USING gin(tags) WHERE is_active;
CREATE INDEX idx_scoring_tests_model ON scoring_tests(model_id, created_at DESC);

-- Triggers
CREATE TRIGGER trg_channel_configs_updated_at
    BEFORE UPDATE ON channel_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_memories_updated_at
    BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_scoring_tests_updated_at
    BEFORE UPDATE ON scoring_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Seed first admin (if no admin exists) ──────────────────
-- The first registered user becomes admin automatically
UPDATE users SET role = 'admin'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
  AND role = 'user';
