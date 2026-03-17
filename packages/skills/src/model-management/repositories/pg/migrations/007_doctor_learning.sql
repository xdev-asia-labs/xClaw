-- Migration 007: Doctor profiles, learning entries, fine-tuning system
-- Supports per-doctor personalization, auto-learning from chat, and fine-tuning pipelines

-- Doctor profiles (linked to existing users table)
CREATE TABLE IF NOT EXISTS doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialty TEXT[] NOT NULL DEFAULT '{}',
  experience_years INTEGER,
  hospital TEXT,
  preferred_model_id TEXT,
  preferred_language VARCHAR(5) DEFAULT 'vi',
  response_style VARCHAR(20) DEFAULT 'detailed'
    CHECK (response_style IN ('concise', 'detailed', 'academic')),
  custom_instructions TEXT DEFAULT '',
  auto_learn BOOLEAN DEFAULT true,
  knowledge_base_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Learning entries auto-extracted from chat conversations
CREATE TABLE IF NOT EXISTS learning_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  source_conversation_id UUID,
  source_message_ids TEXT[] DEFAULT '{}',
  type VARCHAR(30) NOT NULL CHECK (type IN ('preference','correction','knowledge','decision_pattern')),
  category VARCHAR(50) DEFAULT 'other',
  content TEXT NOT NULL,
  context TEXT DEFAULT '',
  confidence REAL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'auto_detected'
    CHECK (status IN ('auto_detected','doctor_confirmed','admin_verified','rejected')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuning datasets metadata
CREATE TABLE IF NOT EXISTS finetune_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  doctor_id UUID REFERENCES doctor_profiles(id) ON DELETE SET NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('chat_history','manual','imported')),
  format VARCHAR(20) NOT NULL DEFAULT 'sharegpt'
    CHECK (format IN ('alpaca','sharegpt','openai')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','reviewing','approved','training','completed')),
  sample_count INTEGER DEFAULT 0,
  quality_score NUMERIC(3,2) DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuning individual training samples
CREATE TABLE IF NOT EXISTS finetune_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES finetune_datasets(id) ON DELETE CASCADE,
  source_conversation_id UUID,
  instruction TEXT NOT NULL DEFAULT '',
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  quality_rating SMALLINT CHECK (quality_rating IS NULL OR quality_rating BETWEEN 1 AND 5),
  quality_notes TEXT,
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','needs_revision')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuning training jobs
CREATE TABLE IF NOT EXISTS finetune_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES finetune_datasets(id) ON DELETE CASCADE,
  base_model VARCHAR(255) NOT NULL,
  method VARCHAR(20) NOT NULL DEFAULT 'qlora'
    CHECK (method IN ('lora','qlora','full')),
  hyperparameters JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','preparing','training','evaluating','completed','failed')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  metrics JSONB DEFAULT '{}',
  output_model VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user ON doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_doctor_status ON learning_entries(doctor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_type ON learning_entries(type, category);
CREATE INDEX IF NOT EXISTS idx_learning_conversation ON learning_entries(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_finetune_datasets_status ON finetune_datasets(status);
CREATE INDEX IF NOT EXISTS idx_finetune_datasets_doctor ON finetune_datasets(doctor_id);
CREATE INDEX IF NOT EXISTS idx_finetune_samples_dataset ON finetune_samples(dataset_id, status);
CREATE INDEX IF NOT EXISTS idx_finetune_jobs_dataset ON finetune_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_finetune_jobs_status ON finetune_jobs(status);
