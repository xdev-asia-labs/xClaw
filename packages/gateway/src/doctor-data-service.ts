// ============================================================
// Doctor Data Service - Doctor profiles, Learning entries,
// Fine-tuning datasets, Chat analysis
// ============================================================

import pg from 'pg';

export interface DoctorProfile {
  id: string;
  user_id: string;
  specialty: string[];
  experience_years: number | null;
  hospital: string | null;
  preferred_model_id: string | null;
  preferred_language: string;
  response_style: 'concise' | 'detailed' | 'academic';
  custom_instructions: string;
  auto_learn: boolean;
  knowledge_base_ids: string[];
  created_at: string;
  updated_at: string;
  // Joined fields
  display_name?: string;
  username?: string;
}

export interface LearningEntry {
  id: string;
  doctor_id: string;
  source_conversation_id: string;
  source_message_ids: string[];
  type: 'preference' | 'correction' | 'knowledge' | 'decision_pattern';
  category: string;
  content: string;
  context: string;
  confidence: number;
  status: 'auto_detected' | 'doctor_confirmed' | 'admin_verified' | 'rejected';
  tags: string[];
  created_at: string;
  updated_at: string;
  // Joined
  doctor_name?: string;
}

export interface FineTuneDataset {
  id: string;
  name: string;
  description: string | null;
  doctor_id: string | null;
  source: 'chat_history' | 'manual' | 'imported';
  format: 'alpaca' | 'sharegpt' | 'openai';
  status: 'draft' | 'reviewing' | 'approved' | 'training' | 'completed';
  sample_count: number;
  quality_score: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FineTuneSample {
  id: string;
  dataset_id: string;
  source_conversation_id: string | null;
  instruction: string;
  input: string;
  output: string;
  quality_rating: number | null;
  quality_notes: string | null;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface FineTuneJob {
  id: string;
  dataset_id: string;
  base_model: string;
  method: 'lora' | 'qlora' | 'full';
  hyperparameters: Record<string, unknown>;
  status: 'queued' | 'preparing' | 'training' | 'evaluating' | 'completed' | 'failed';
  progress: number;
  metrics: Record<string, unknown>;
  output_model: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  // Joined
  dataset_name?: string;
}

export interface MessageFeedback {
  id: string;
  conversation_id: string;
  message_id: string;
  user_id: string;
  rating: 'positive' | 'negative' | 'correction';
  correction_text: string | null;
  created_at: string;
}

export interface DataQualityStats {
  total_learning_entries: number;
  pending_review: number;
  approved: number;
  rejected: number;
  avg_confidence: number;
  by_type: { type: string; count: number }[];
  by_category: { category: string; count: number }[];
  active_doctors: number;
  quality_trend: { date: string; score: number; count: number }[];
}

export interface DoctorChatAnalysis {
  total_conversations: number;
  total_messages: number;
  total_learnings: number;
  correction_rate: number;
  avg_satisfaction: number;
  topics: { topic: string; count: number }[];
  timeline: {
    id: string;
    title: string;
    created_at: string;
    message_count: number;
    learning_count: number;
    has_correction: boolean;
  }[];
}

export class DoctorDataService {
  constructor(private pool: pg.Pool) {}

  // ─── Init Tables ──────────────────────────────────────────

  async initTables(): Promise<void> {
    await this.pool.query(`
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

      CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user ON doctor_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_learning_doctor_status ON learning_entries(doctor_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_learning_type ON learning_entries(type, category);
      CREATE INDEX IF NOT EXISTS idx_finetune_datasets_status ON finetune_datasets(status);
      CREATE INDEX IF NOT EXISTS idx_finetune_samples_dataset ON finetune_samples(dataset_id, status);
      CREATE INDEX IF NOT EXISTS idx_finetune_jobs_dataset ON finetune_jobs(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_finetune_jobs_status ON finetune_jobs(status);
    `);
  }

  // ─── Doctor Profiles ──────────────────────────────────────

  async getDoctorProfiles(): Promise<DoctorProfile[]> {
    const r = await this.pool.query(`
      SELECT dp.*, u.display_name, u.username
      FROM doctor_profiles dp
      JOIN users u ON u.id = dp.user_id
      ORDER BY dp.created_at DESC
    `);
    return r.rows;
  }

  async getDoctorProfileByUserId(userId: string): Promise<DoctorProfile | null> {
    const r = await this.pool.query(`
      SELECT dp.*, u.display_name, u.username
      FROM doctor_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.user_id = $1
    `, [userId]);
    return r.rows[0] ?? null;
  }

  async getDoctorProfileById(id: string): Promise<DoctorProfile | null> {
    const r = await this.pool.query(`
      SELECT dp.*, u.display_name, u.username
      FROM doctor_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.id = $1
    `, [id]);
    return r.rows[0] ?? null;
  }

  async createDoctorProfile(data: {
    user_id: string;
    specialty?: string[];
    experience_years?: number;
    hospital?: string;
    preferred_language?: string;
    response_style?: string;
    custom_instructions?: string;
    auto_learn?: boolean;
  }): Promise<DoctorProfile> {
    const r = await this.pool.query(`
      INSERT INTO doctor_profiles (user_id, specialty, experience_years, hospital,
        preferred_language, response_style, custom_instructions, auto_learn)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.user_id,
      data.specialty ?? [],
      data.experience_years ?? null,
      data.hospital ?? null,
      data.preferred_language ?? 'vi',
      data.response_style ?? 'detailed',
      data.custom_instructions ?? '',
      data.auto_learn ?? true,
    ]);
    return r.rows[0];
  }

  async updateDoctorProfile(id: string, data: Partial<DoctorProfile>): Promise<DoctorProfile> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowed = ['specialty', 'experience_years', 'hospital', 'preferred_model_id',
      'preferred_language', 'response_style', 'custom_instructions', 'auto_learn', 'knowledge_base_ids'];

    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${idx}`);
        values.push((data as any)[key]);
        idx++;
      }
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const r = await this.pool.query(
      `UPDATE doctor_profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return r.rows[0];
  }

  async getDoctorStats(doctorId: string): Promise<{
    total_learnings: number;
    confirmed: number;
    pending: number;
    rejected: number;
    total_conversations: number;
    total_messages: number;
  }> {
    const learning = await this.pool.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('doctor_confirmed','admin_verified'))::int as confirmed,
        COUNT(*) FILTER (WHERE status = 'auto_detected')::int as pending,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected
      FROM learning_entries WHERE doctor_id = $1
    `, [doctorId]);

    const profile = await this.pool.query(
      `SELECT user_id FROM doctor_profiles WHERE id = $1`, [doctorId]
    );
    const userId = profile.rows[0]?.user_id;

    let convCount = 0, msgCount = 0;
    if (userId) {
      const conv = await this.pool.query(
        `SELECT COUNT(*)::int as c FROM conversations WHERE user_id = $1`, [userId]
      );
      convCount = conv.rows[0]?.c ?? 0;
      const msg = await this.pool.query(`
        SELECT COUNT(*)::int as c FROM chat_messages cm
        JOIN conversations co ON co.id = cm.conversation_id
        WHERE co.user_id = $1
      `, [userId]);
      msgCount = msg.rows[0]?.c ?? 0;
    }

    const ls = learning.rows[0];
    return {
      total_learnings: ls.total,
      confirmed: ls.confirmed,
      pending: ls.pending,
      rejected: ls.rejected,
      total_conversations: convCount,
      total_messages: msgCount,
    };
  }

  // ─── Learning Entries ─────────────────────────────────────

  async getLearningEntries(opts: {
    doctor_id?: string;
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: LearningEntry[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (opts.doctor_id) {
      conditions.push(`le.doctor_id = $${idx++}`);
      values.push(opts.doctor_id);
    }
    if (opts.status) {
      conditions.push(`le.status = $${idx++}`);
      values.push(opts.status);
    }
    if (opts.type) {
      conditions.push(`le.type = $${idx++}`);
      values.push(opts.type);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const countQ = await this.pool.query(
      `SELECT COUNT(*)::int as total FROM learning_entries le ${where}`, values
    );

    const dataQ = await this.pool.query(`
      SELECT le.*, u.display_name as doctor_name
      FROM learning_entries le
      JOIN doctor_profiles dp ON dp.id = le.doctor_id
      JOIN users u ON u.id = dp.user_id
      ${where}
      ORDER BY le.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...values, limit, offset]);

    return { entries: dataQ.rows, total: countQ.rows[0].total };
  }

  async getLearningEntry(id: string): Promise<LearningEntry | null> {
    const r = await this.pool.query(`
      SELECT le.*, u.display_name as doctor_name
      FROM learning_entries le
      JOIN doctor_profiles dp ON dp.id = le.doctor_id
      JOIN users u ON u.id = dp.user_id
      WHERE le.id = $1
    `, [id]);
    return r.rows[0] ?? null;
  }

  async createLearningEntry(data: {
    doctor_id: string;
    source_conversation_id?: string;
    source_message_ids?: string[];
    type: string;
    category?: string;
    content: string;
    context?: string;
    confidence?: number;
    tags?: string[];
  }): Promise<LearningEntry> {
    const r = await this.pool.query(`
      INSERT INTO learning_entries (doctor_id, source_conversation_id, source_message_ids,
        type, category, content, context, confidence, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      data.doctor_id,
      data.source_conversation_id ?? null,
      data.source_message_ids ?? [],
      data.type,
      data.category ?? 'other',
      data.content,
      data.context ?? '',
      data.confidence ?? 0,
      data.tags ?? [],
    ]);
    return r.rows[0];
  }

  async updateLearningEntryStatus(id: string, status: string, reviewerId?: string): Promise<LearningEntry> {
    const r = await this.pool.query(`
      UPDATE learning_entries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [status, id]);
    return r.rows[0];
  }

  // ─── Data Quality Stats ───────────────────────────────────

  async getDataQualityStats(days: number = 30): Promise<DataQualityStats> {
    const cutoff = `NOW() - INTERVAL '${Math.min(Math.max(days, 1), 365)} days'`;

    const [totals, byType, byCat, doctorCount, trend] = await Promise.all([
      this.pool.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'auto_detected')::int as pending,
          COUNT(*) FILTER (WHERE status IN ('doctor_confirmed','admin_verified'))::int as approved,
          COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
          COALESCE(AVG(confidence), 0)::real as avg_confidence
        FROM learning_entries WHERE created_at >= ${cutoff}
      `),
      this.pool.query(`
        SELECT type, COUNT(*)::int as count FROM learning_entries
        WHERE created_at >= ${cutoff} GROUP BY type ORDER BY count DESC
      `),
      this.pool.query(`
        SELECT category, COUNT(*)::int as count FROM learning_entries
        WHERE created_at >= ${cutoff} GROUP BY category ORDER BY count DESC
      `),
      this.pool.query(`
        SELECT COUNT(DISTINCT doctor_id)::int as c FROM learning_entries
        WHERE created_at >= ${cutoff}
      `),
      this.pool.query(`
        SELECT DATE(created_at) as date,
          COALESCE(AVG(confidence), 0)::real as score,
          COUNT(*)::int as count
        FROM learning_entries
        WHERE created_at >= ${cutoff}
        GROUP BY DATE(created_at)
        ORDER BY date
      `),
    ]);

    const t = totals.rows[0];
    return {
      total_learning_entries: t.total,
      pending_review: t.pending,
      approved: t.approved,
      rejected: t.rejected,
      avg_confidence: t.avg_confidence,
      by_type: byType.rows,
      by_category: byCat.rows,
      active_doctors: doctorCount.rows[0].c,
      quality_trend: trend.rows,
    };
  }

  // ─── Fine-Tune Datasets ───────────────────────────────────

  async getFineTuneDatasets(): Promise<FineTuneDataset[]> {
    const r = await this.pool.query(`
      SELECT * FROM finetune_datasets ORDER BY created_at DESC
    `);
    return r.rows;
  }

  async getFineTuneDataset(id: string): Promise<FineTuneDataset | null> {
    const r = await this.pool.query(`SELECT * FROM finetune_datasets WHERE id = $1`, [id]);
    return r.rows[0] ?? null;
  }

  async createFineTuneDataset(data: {
    name: string;
    description?: string;
    doctor_id?: string;
    source?: string;
    format?: string;
    created_by: string;
  }): Promise<FineTuneDataset> {
    const r = await this.pool.query(`
      INSERT INTO finetune_datasets (name, description, doctor_id, source, format, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [
      data.name, data.description ?? null, data.doctor_id ?? null,
      data.source ?? 'manual', data.format ?? 'sharegpt', data.created_by,
    ]);
    return r.rows[0];
  }

  async updateFineTuneDataset(id: string, data: Partial<FineTuneDataset>): Promise<FineTuneDataset> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const allowed = ['name', 'description', 'status', 'format', 'quality_score'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${idx++}`);
        values.push((data as any)[key]);
      }
    }
    fields.push('updated_at = NOW()');
    values.push(id);
    const r = await this.pool.query(
      `UPDATE finetune_datasets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return r.rows[0];
  }

  async deleteFineTuneDataset(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM finetune_datasets WHERE id = $1`, [id]);
  }

  // ─── Fine-Tune Samples ───────────────────────────────────

  async getFineTuneSamples(datasetId: string, opts?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ samples: FineTuneSample[]; total: number }> {
    const conditions = ['dataset_id = $1'];
    const values: unknown[] = [datasetId];
    let idx = 2;

    if (opts?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(opts.status);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;

    const [countQ, dataQ] = await Promise.all([
      this.pool.query(`SELECT COUNT(*)::int as total FROM finetune_samples ${where}`, values),
      this.pool.query(`
        SELECT * FROM finetune_samples ${where}
        ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}
      `, [...values, limit, offset]),
    ]);

    return { samples: dataQ.rows, total: countQ.rows[0].total };
  }

  async createFineTuneSample(data: {
    dataset_id: string;
    source_conversation_id?: string;
    instruction: string;
    input: string;
    output: string;
    tags?: string[];
  }): Promise<FineTuneSample> {
    const r = await this.pool.query(`
      INSERT INTO finetune_samples (dataset_id, source_conversation_id, instruction, input, output, tags)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [
      data.dataset_id, data.source_conversation_id ?? null,
      data.instruction, data.input, data.output, data.tags ?? [],
    ]);
    // Update sample count
    await this.pool.query(`
      UPDATE finetune_datasets SET sample_count = (
        SELECT COUNT(*) FROM finetune_samples WHERE dataset_id = $1
      ), updated_at = NOW() WHERE id = $1
    `, [data.dataset_id]);
    return r.rows[0];
  }

  async updateFineTuneSample(id: string, data: {
    status?: string;
    quality_rating?: number;
    quality_notes?: string;
    reviewed_by?: string;
    instruction?: string;
    input?: string;
    output?: string;
  }): Promise<FineTuneSample> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (data.status && data.reviewed_by) {
      fields.push(`reviewed_at = NOW()`);
    }
    values.push(id);
    const r = await this.pool.query(
      `UPDATE finetune_samples SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    // Update dataset quality_score
    if (data.quality_rating) {
      const sample = r.rows[0];
      await this.pool.query(`
        UPDATE finetune_datasets SET quality_score = (
          SELECT COALESCE(AVG(quality_rating), 0) FROM finetune_samples
          WHERE dataset_id = $1 AND quality_rating IS NOT NULL
        ), updated_at = NOW() WHERE id = $1
      `, [sample.dataset_id]);
    }
    return r.rows[0];
  }

  // ─── Fine-Tune Jobs ───────────────────────────────────────

  async getFineTuneJobs(datasetId?: string): Promise<FineTuneJob[]> {
    if (datasetId) {
      const r = await this.pool.query(`
        SELECT fj.*, fd.name as dataset_name
        FROM finetune_jobs fj JOIN finetune_datasets fd ON fd.id = fj.dataset_id
        WHERE fj.dataset_id = $1 ORDER BY fj.created_at DESC
      `, [datasetId]);
      return r.rows;
    }
    const r = await this.pool.query(`
      SELECT fj.*, fd.name as dataset_name
      FROM finetune_jobs fj JOIN finetune_datasets fd ON fd.id = fj.dataset_id
      ORDER BY fj.created_at DESC
    `);
    return r.rows;
  }

  async createFineTuneJob(data: {
    dataset_id: string;
    base_model: string;
    method?: string;
    hyperparameters?: Record<string, unknown>;
  }): Promise<FineTuneJob> {
    const r = await this.pool.query(`
      INSERT INTO finetune_jobs (dataset_id, base_model, method, hyperparameters)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [
      data.dataset_id, data.base_model,
      data.method ?? 'qlora', JSON.stringify(data.hyperparameters ?? {}),
    ]);
    return r.rows[0];
  }

  async updateFineTuneJob(id: string, data: Partial<FineTuneJob>): Promise<FineTuneJob> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const allowed = ['status', 'progress', 'metrics', 'output_model', 'error_message', 'started_at', 'completed_at'];
    for (const key of allowed) {
      if (key in data) {
        const val = key === 'metrics' ? JSON.stringify((data as any)[key]) : (data as any)[key];
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    values.push(id);
    const r = await this.pool.query(
      `UPDATE finetune_jobs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return r.rows[0];
  }

  // ─── Chat Analysis ────────────────────────────────────────

  async getDoctorChatAnalysis(doctorId: string, days: number = 30): Promise<DoctorChatAnalysis> {
    const profile = await this.pool.query(
      `SELECT user_id FROM doctor_profiles WHERE id = $1`, [doctorId]
    );
    const userId = profile.rows[0]?.user_id;
    if (!userId) {
      return {
        total_conversations: 0, total_messages: 0, total_learnings: 0,
        correction_rate: 0, avg_satisfaction: 0, topics: [], timeline: [],
      };
    }

    const cutoff = `NOW() - INTERVAL '${Math.min(Math.max(days, 1), 365)} days'`;

    const [convCount, msgCount, learningCount, corrections, feedback, timeline] = await Promise.all([
      this.pool.query(`SELECT COUNT(*)::int as c FROM conversations WHERE user_id = $1 AND created_at >= ${cutoff}`, [userId]),
      this.pool.query(`
        SELECT COUNT(*)::int as c FROM chat_messages cm
        JOIN conversations co ON co.id = cm.conversation_id
        WHERE co.user_id = $1 AND cm.created_at >= ${cutoff}
      `, [userId]),
      this.pool.query(`
        SELECT COUNT(*)::int as c FROM learning_entries WHERE doctor_id = $1 AND created_at >= ${cutoff}
      `, [doctorId]),
      this.pool.query(`
        SELECT COUNT(*)::int as c FROM learning_entries
        WHERE doctor_id = $1 AND type = 'correction' AND created_at >= ${cutoff}
      `, [doctorId]),
      this.pool.query(`
        SELECT COALESCE(AVG(CASE WHEN mf.rating = 'up' THEN 5 WHEN mf.rating = 'down' THEN 1 ELSE 3 END), 0)::real as avg_sat
        FROM message_feedback mf
        JOIN chat_messages cm ON cm.id::text = mf.message_id
        JOIN conversations co ON co.id = cm.conversation_id
        WHERE co.user_id = $1 AND mf.created_at >= ${cutoff}
      `, [userId]),
      this.pool.query(`
        SELECT co.id, co.title,co.created_at,
          (SELECT COUNT(*)::int FROM chat_messages WHERE conversation_id = co.id) as message_count,
          (SELECT COUNT(*)::int FROM learning_entries WHERE source_conversation_id = co.id::text) as learning_count,
          EXISTS(SELECT 1 FROM learning_entries WHERE source_conversation_id = co.id::text AND type = 'correction') as has_correction
        FROM conversations co
        WHERE co.user_id = $1 AND co.created_at >= ${cutoff}
        ORDER BY co.created_at DESC LIMIT 50
      `, [userId]),
    ]);

    const totalMsgs = msgCount.rows[0].c || 1;
    const correctionCount = corrections.rows[0].c;

    return {
      total_conversations: convCount.rows[0].c,
      total_messages: msgCount.rows[0].c,
      total_learnings: learningCount.rows[0].c,
      correction_rate: (correctionCount / totalMsgs) * 100,
      avg_satisfaction: feedback.rows[0].avg_sat,
      topics: [], // Would be enriched with topic extraction
      timeline: timeline.rows,
    };
  }

  // ─── Auto-Learning Extraction ─────────────────────────────

  /**
   * Analyzes a conversation to extract learning entries.
   * Uses pattern matching on conversation messages to detect:
   * - Corrections: User corrects AI response
   * - Preferences: User states a preference
   * - Knowledge: User shares domain knowledge
   * - Decision patterns: User explains reasoning
   *
   * Returns extracted entries for storage.
   */
  async extractLearningFromConversation(
    doctorId: string,
    conversationId: string,
    messages: { role: string; content: string; id?: string }[],
    llmClassify?: (prompt: string) => Promise<string>,
  ): Promise<LearningEntry[]> {
    const entries: LearningEntry[] = [];

    // Build pairs of (assistant_message, user_response)
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];

      // Only check user messages that follow assistant messages
      if (prev.role !== 'assistant' || curr.role !== 'user') continue;

      const userMsg = curr.content.toLowerCase();
      const context = `AI: ${prev.content.substring(0, 500)}\nUser: ${curr.content.substring(0, 500)}`;

      // Pattern-based detection with confidence scoring
      let detected: { type: string; content: string; confidence: number; category: string } | null = null;

      // 1. Correction patterns
      const correctionPatterns = [
        /không[,.]?\s*(đúng|phải)/i, /sai\s*rồi/i, /chỉnh\s*lại/i,
        /liều\s*(đúng|chính\s*xác)\s*(là|phải)/i, /no[,.]?\s*the\s*(correct|right)/i,
        /actually[,.]?\s*(it|the|should)/i, /that'?s\s*(wrong|incorrect)/i,
        /should\s*be\s*/i, /not\s+\d+\s*mg/i, /chứ\s*không\s*phải/i,
      ];
      for (const p of correctionPatterns) {
        if (p.test(curr.content)) {
          detected = { type: 'correction', content: curr.content, confidence: 0.85, category: 'medication' };
          break;
        }
      }

      // 2. Preference patterns
      if (!detected) {
        const prefPatterns = [
          /tôi\s*(luôn|thường|hay)\s*(dùng|chọn|ưu\s*tiên|prefer)/i,
          /ưu\s*tiên\s*(dùng|chọn)/i, /i\s*(always|usually|prefer)/i,
          /first[\s-]*line\s*(cho|for)/i, /lựa\s*chọn\s*(đầu|hàng\s*đầu)/i,
          /my\s*preference\s*is/i, /i\s*tend\s*to\s*use/i,
        ];
        for (const p of prefPatterns) {
          if (p.test(curr.content)) {
            detected = { type: 'preference', content: curr.content, confidence: 0.82, category: 'medication' };
            break;
          }
        }
      }

      // 3. Knowledge sharing patterns
      if (!detected) {
        const knowPatterns = [
          /theo\s*(guideline|hướng\s*dẫn|khuyến\s*cáo)/i,
          /nghiên\s*cứu\s*(cho\s*thấy|chỉ\s*ra)/i,
          /evidence\s*(shows?|suggests?)/i,
          /lưu\s*ý\s*(rằng|là)/i, /cần\s*nhớ/i,
          /kinh\s*nghiệm\s*(của\s*tôi|lâm\s*sàng)/i,
        ];
        for (const p of knowPatterns) {
          if (p.test(curr.content)) {
            detected = { type: 'knowledge', content: curr.content, confidence: 0.75, category: 'other' };
            break;
          }
        }
      }

      // 4. Decision pattern
      if (!detected) {
        const decisionPatterns = [
          /vì\s*(vậy|thế)\s*(tôi|nên|cần)/i, /lý\s*do\s*(là|tôi)/i,
          /reasoning\s*(is|behind)/i, /because\s*(in\s*this|the\s*patient|CrCl|eGFR)/i,
          /trước\s*khi\s*(kê|cho)\s*(đơn|thuốc)/i, /phải\s*check/i,
          /approach\s*(is|would\s*be)/i,
        ];
        for (const p of decisionPatterns) {
          if (p.test(curr.content)) {
            detected = { type: 'decision_pattern', content: curr.content, confidence: 0.70, category: 'other' };
            break;
          }
        }
      }

      // If LLM classifier is available and no pattern matched but msg is substantial
      if (!detected && llmClassify && curr.content.length > 80) {
        try {
          const classifyPrompt = `Analyze this doctor-AI conversation exchange. Does the doctor's message contain any of these?
1. "correction" - Doctor corrects the AI's response
2. "preference" - Doctor states a personal clinical preference
3. "knowledge" - Doctor shares medical knowledge or evidence
4. "decision_pattern" - Doctor explains their clinical reasoning

AI said: "${prev.content.substring(0, 300)}"
Doctor replied: "${curr.content.substring(0, 300)}"

Reply with ONLY a JSON object: {"type": "correction"|"preference"|"knowledge"|"decision_pattern"|"none", "confidence": 0.0-1.0, "category": "medication"|"diagnosis"|"procedure"|"lab_interpretation"|"other", "summary": "brief summary"}`;
          const result = await llmClassify(classifyPrompt);
          try {
            const parsed = JSON.parse(result.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
            if (parsed.type !== 'none' && parsed.confidence > 0.6) {
              detected = {
                type: parsed.type,
                content: parsed.summary || curr.content,
                confidence: parsed.confidence,
                category: parsed.category || 'other',
              };
            }
          } catch { /* ignore parse errors */ }
        } catch { /* ignore LLM errors */ }
      }

      if (detected && detected.confidence >= 0.6) {
        const entry = await this.createLearningEntry({
          doctor_id: doctorId,
          source_conversation_id: conversationId,
          source_message_ids: [prev.id ?? '', curr.id ?? ''].filter(Boolean),
          type: detected.type,
          category: detected.category,
          content: detected.content,
          context,
          confidence: detected.confidence,
          tags: this.extractTags(detected.content),
        });
        entries.push(entry);
      }
    }

    return entries;
  }

  /** Simple tag extraction from medical text */
  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const lower = text.toLowerCase();
    const keywords: Record<string, string[]> = {
      'hypertension': ['tăng huyết áp', 'hypertension', 'tha', 'huyết áp'],
      'diabetes': ['đái tháo đường', 'diabetes', 'đtđ', 'tiểu đường', 'metformin', 'insulin'],
      'cardiology': ['tim mạch', 'cardio', 'heart', 'acs', 'stemi', 'nstemi'],
      'nephrology': ['thận', 'kidney', 'ckd', 'creatinine', 'egfr', 'crcl'],
      'medication': ['thuốc', 'liều', 'dose', 'mg', 'drug', 'medication', 'prescription'],
      'drug-interaction': ['tương tác', 'interaction', 'contraindic'],
      'lab': ['xét nghiệm', 'lab', 'bnp', 'troponin', 'hba1c', 'crp'],
    };
    for (const [tag, patterns] of Object.entries(keywords)) {
      if (patterns.some(p => lower.includes(p))) tags.push(tag);
    }
    return tags.slice(0, 10);
  }

  // ─── Generate Fine-tune Samples from Learning Entries ─────

  async generateSamplesFromLearning(datasetId: string, opts: {
    doctor_id?: string;
    min_confidence?: number;
    types?: string[];
    limit?: number;
  }): Promise<number> {
    const conditions = [`status IN ('doctor_confirmed','admin_verified')`];
    const values: unknown[] = [];
    let idx = 1;

    if (opts.doctor_id) {
      conditions.push(`doctor_id = $${idx++}`);
      values.push(opts.doctor_id);
    }
    if (opts.min_confidence) {
      conditions.push(`confidence >= $${idx++}`);
      values.push(opts.min_confidence);
    }
    if (opts.types?.length) {
      conditions.push(`type = ANY($${idx++})`);
      values.push(opts.types);
    }

    const limit = Math.min(opts.limit ?? 500, 5000);
    const entries = await this.pool.query(`
      SELECT * FROM learning_entries WHERE ${conditions.join(' AND ')}
      ORDER BY confidence DESC, created_at DESC LIMIT $${idx}
    `, [...values, limit]);

    let created = 0;
    for (const entry of entries.rows) {
      const instruction = 'Bạn là trợ lý y khoa AI. Hãy trả lời chính xác và theo kinh nghiệm lâm sàng.';
      const input = entry.type === 'correction'
        ? `Hãy trả lời chính xác câu hỏi sau (lưu ý: ${entry.content.substring(0, 200)})`
        : entry.context.split('\nUser:')[0]?.replace('AI: ', '') || 'Tư vấn y khoa';
      const output = entry.content;

      await this.createFineTuneSample({
        dataset_id: datasetId,
        source_conversation_id: entry.source_conversation_id,
        instruction,
        input,
        output,
        tags: entry.tags,
      });
      created++;
    }

    return created;
  }
}
