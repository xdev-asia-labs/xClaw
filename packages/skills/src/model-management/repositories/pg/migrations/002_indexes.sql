-- ============================================================
-- Migration 002: Performance indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_model_profiles_provider_status
    ON model_profiles (provider, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_model_profiles_is_default
    ON model_profiles (is_default) WHERE is_default = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_model_profiles_created_at
    ON model_profiles (created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_usage_model_date
    ON usage_records (model_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_date
    ON usage_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_session
    ON usage_records (session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_benchmarks_model_type
    ON benchmark_results (model_profile_id, test_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_sessions_active
    ON model_sessions (session_id, valid_from DESC)
    WHERE valid_to = 'infinity';

CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_date
    ON audit_log (created_at DESC);
