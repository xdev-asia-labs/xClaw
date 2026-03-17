// ============================================================
// Auth Service - User authentication + per-user chat history
// ============================================================

import { scrypt, randomBytes, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import pg from 'pg';

const scryptAsync = promisify(scrypt);

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  modelId?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: string;
}

// Session tokens - in-memory (fast) with DB user lookup
const activeSessions = new Map<string, { userId: string; expiresAt: number }>();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return salt + ':' + derived.toString('hex');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, 'hex');
  return timingSafeEqual(derived, keyBuffer);
}

export class AuthService {
  constructor(private pool: pg.Pool) {}

  // ─── User Auth ─────────────────────────────────────────

  async register(username: string, password: string, displayName: string): Promise<{ user: AuthUser; token: string }> {
    // Validate
    if (!username || username.length < 3) throw new Error('Username must be at least 3 characters');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    if (!displayName) throw new Error('Display name is required');

    // Check duplicate
    const existing = await this.pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) throw new Error('Username already taken');

    const passwordHash = await hashPassword(password);

    // First user gets admin role automatically
    const countResult = await this.pool.query('SELECT count(*)::int AS cnt FROM users');
    const isFirst = countResult.rows[0].cnt === 0;

    const result = await this.pool.query(
      `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role, avatar_url`,
      [username, passwordHash, displayName, isFirst ? 'admin' : 'user'],
    );

    const row = result.rows[0];
    const user: AuthUser = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      avatarUrl: row.avatar_url,
    };

    const token = this.createToken(user.id);
    return { user, token };
  }

  async login(username: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const result = await this.pool.query(
      'SELECT id, username, display_name, role, avatar_url, password_hash, is_active FROM users WHERE username = $1',
      [username],
    );

    if (result.rows.length === 0) throw new Error('Invalid credentials');

    const row = result.rows[0];
    if (!row.is_active) throw new Error('Account is disabled');

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) throw new Error('Invalid credentials');

    // Update last login
    await this.pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);

    const user: AuthUser = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      avatarUrl: row.avatar_url,
    };

    const token = this.createToken(user.id);
    return { user, token };
  }

  async getUserByToken(token: string): Promise<AuthUser | null> {
    const session = activeSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      activeSessions.delete(token);
      return null;
    }

    const result = await this.pool.query(
      'SELECT id, username, display_name, role, avatar_url FROM users WHERE id = $1 AND is_active = true',
      [session.userId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      avatarUrl: row.avatar_url,
    };
  }

  logout(token: string): void {
    activeSessions.delete(token);
  }

  private createToken(userId: string): string {
    const token = randomBytes(32).toString('hex');
    activeSessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL });
    return token;
  }

  // ─── Conversations ────────────────────────────────────

  async getConversations(userId: string): Promise<Conversation[]> {
    const result = await this.pool.query(
      `SELECT id, user_id, title, model_id, is_archived, created_at, updated_at
       FROM conversations WHERE user_id = $1 AND NOT is_archived
       ORDER BY updated_at DESC LIMIT 50`,
      [userId],
    );
    return result.rows.map(r => ({
      id: r.id, userId: r.user_id, title: r.title, modelId: r.model_id,
      isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  async createConversation(userId: string, title?: string): Promise<Conversation> {
    const result = await this.pool.query(
      `INSERT INTO conversations (user_id, title) VALUES ($1, $2)
       RETURNING id, user_id, title, model_id, is_archived, created_at, updated_at`,
      [userId, title || 'New Chat'],
    );
    const r = result.rows[0];
    return {
      id: r.id, userId: r.user_id, title: r.title, modelId: r.model_id,
      isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await this.pool.query(
      'UPDATE conversations SET is_archived = true WHERE id = $1 AND user_id = $2',
      [conversationId, userId],
    );
  }

  async renameConversation(userId: string, conversationId: string, title: string): Promise<void> {
    await this.pool.query(
      'UPDATE conversations SET title = $1 WHERE id = $2 AND user_id = $3',
      [title, conversationId, userId],
    );
  }

  // ─── Chat Messages ───────────────────────────────────

  async getMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
    // Verify ownership
    const conv = await this.pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId],
    );
    if (conv.rows.length === 0) throw new Error('Conversation not found');

    const result = await this.pool.query(
      `SELECT id, conversation_id, role, content, tokens_used, latency_ms, created_at
       FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId],
    );
    return result.rows.map(r => ({
      id: r.id, conversationId: r.conversation_id, role: r.role,
      content: r.content, tokensUsed: r.tokens_used, latencyMs: r.latency_ms,
      createdAt: r.created_at,
    }));
  }

  async saveMessage(conversationId: string, role: string, content: string, extra?: { tokensUsed?: number; latencyMs?: number }): Promise<ChatMessage> {
    const result = await this.pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content, tokens_used, latency_ms)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, conversation_id, role, content, tokens_used, latency_ms, created_at`,
      [conversationId, role, content, extra?.tokensUsed ?? null, extra?.latencyMs ?? null],
    );

    // Update conversation timestamp
    await this.pool.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [conversationId]);

    const r = result.rows[0];
    return {
      id: r.id, conversationId: r.conversation_id, role: r.role,
      content: r.content, tokensUsed: r.tokens_used, latencyMs: r.latency_ms,
      createdAt: r.created_at,
    };
  }

  /** Auto-generate conversation title from first user message */
  async autoTitle(conversationId: string, firstMessage: string): Promise<void> {
    const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + '...' : firstMessage;
    await this.pool.query(
      `UPDATE conversations SET title = $1 WHERE id = $2 AND title = 'New Chat'`,
      [title, conversationId],
    );
  }

  // ─── Admin Methods ────────────────────────────────────

  async listUsers(): Promise<Array<AuthUser & { isActive: boolean; createdAt: string; lastLoginAt: string | null }>> {
    const result = await this.pool.query(
      `SELECT id, username, display_name, role, avatar_url, is_active, created_at, last_login_at
       FROM users ORDER BY created_at ASC`,
    );
    return result.rows.map(r => ({
      id: r.id, username: r.username, displayName: r.display_name,
      role: r.role, avatarUrl: r.avatar_url, isActive: r.is_active,
      createdAt: r.created_at, lastLoginAt: r.last_login_at,
    }));
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await this.pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    await this.pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId]);
  }

  async isFirstUser(userId: string): Promise<boolean> {
    const result = await this.pool.query('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
    return result.rows.length > 0 && result.rows[0].id === userId;
  }

  // ─── Channel Config ──────────────────────────────────

  async listChannelConfigs(): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, platform, display_name, is_enabled, config, status, last_connected_at, created_at, updated_at
       FROM channel_configs ORDER BY created_at ASC`,
    );
    return result.rows.map(r => ({
      id: r.id, platform: r.platform, displayName: r.display_name,
      isEnabled: r.is_enabled, config: r.config, status: r.status,
      lastConnectedAt: r.last_connected_at, createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  async getChannelConfig(platform: string): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT id, platform, display_name, is_enabled, config, status
       FROM channel_configs WHERE platform = $1`,
      [platform],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id, platform: r.platform, displayName: r.display_name,
      isEnabled: r.is_enabled, config: r.config, status: r.status,
    };
  }

  async upsertChannelConfig(data: { platform: string; displayName: string; config: Record<string, unknown>; isEnabled?: boolean }, createdBy: string): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO channel_configs (platform, display_name, config, is_enabled, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (platform) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         config = EXCLUDED.config,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = now()
       RETURNING id, platform, display_name, is_enabled, config, status, created_at, updated_at`,
      [data.platform, data.displayName, JSON.stringify(data.config), data.isEnabled ?? false, createdBy],
    );
    const r = result.rows[0];
    return {
      id: r.id, platform: r.platform, displayName: r.display_name,
      isEnabled: r.is_enabled, config: r.config, status: r.status,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  async deleteChannelConfig(id: string): Promise<void> {
    await this.pool.query('DELETE FROM channel_configs WHERE id = $1', [id]);
  }

  async updateChannelStatus(platform: string, status: string): Promise<void> {
    const lastConnected = status === 'connected' ? 'now()' : 'last_connected_at';
    await this.pool.query(
      `UPDATE channel_configs SET status = $1, is_enabled = $2, last_connected_at = ${lastConnected} WHERE platform = $3`,
      [status, status === 'connected', platform],
    );
  }

  // ─── API Keys ────────────────────────────────────────

  async createApiKey(userId: string, name: string): Promise<{ key: string; id: string; prefix: string }> {
    const raw = randomBytes(32).toString('hex');
    const prefix = raw.slice(0, 8);
    const keyHash = createHash('sha256').update(raw).digest('hex');

    const result = await this.pool.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, name, prefix, keyHash],
    );
    return { key: `axk_${raw}`, id: result.rows[0].id, prefix };
  }

  async getUserByApiKey(apiKey: string): Promise<AuthUser | null> {
    if (!apiKey.startsWith('axk_')) return null;
    const raw = apiKey.slice(4);
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const prefix = raw.slice(0, 8);

    const result = await this.pool.query(
      `SELECT u.id, u.username, u.display_name, u.role, u.avatar_url
       FROM api_keys ak JOIN users u ON ak.user_id = u.id
       WHERE ak.key_prefix = $1 AND ak.key_hash = $2 AND ak.is_active = true AND u.is_active = true
         AND (ak.expires_at IS NULL OR ak.expires_at > now())`,
      [prefix, keyHash],
    );
    if (result.rows.length === 0) return null;

    // Update last used
    await this.pool.query(`UPDATE api_keys SET last_used_at = now() WHERE key_prefix = $1 AND key_hash = $2`, [prefix, keyHash]);

    const r = result.rows[0];
    return { id: r.id, username: r.username, displayName: r.display_name, role: r.role, avatarUrl: r.avatar_url };
  }

  async listApiKeys(): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT ak.id, ak.user_id, ak.name, ak.key_prefix, ak.scopes, ak.is_active, ak.last_used_at, ak.created_at, u.username
       FROM api_keys ak JOIN users u ON ak.user_id = u.id ORDER BY ak.created_at DESC`,
    );
    return result.rows.map(r => ({
      id: r.id, userId: r.user_id, username: r.username, name: r.name,
      prefix: r.key_prefix, scopes: r.scopes, isActive: r.is_active,
      lastUsedAt: r.last_used_at, createdAt: r.created_at,
    }));
  }

  async listApiKeysForUser(userId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, name, key_prefix, scopes, is_active, last_used_at, created_at
       FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(r => ({
      id: r.id, name: r.name, prefix: r.key_prefix, scopes: r.scopes,
      isActive: r.is_active, lastUsedAt: r.last_used_at, createdAt: r.created_at,
    }));
  }

  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    await this.pool.query('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [keyId, userId]);
  }
}
