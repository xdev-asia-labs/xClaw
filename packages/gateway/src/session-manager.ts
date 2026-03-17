// ============================================================
// Session Manager - Manages active gateway sessions
// ============================================================

import type { GatewaySession, ChatPlatform } from '@xclaw/shared';

export class SessionManager {
  private sessions: Map<string, GatewaySession> = new Map();
  private sessionTimeout: number;
  private maxPerUser: number;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(timeout = 30 * 60_000, maxPerUser = 5) {
    this.sessionTimeout = timeout;
    this.maxPerUser = maxPerUser;
  }

  create(userId: string, platform: ChatPlatform, channelId: string): GatewaySession {
    // Enforce max sessions per user
    const userSessions = this.getByUser(userId);
    if (userSessions.length >= this.maxPerUser) {
      // Remove oldest session
      const oldest = userSessions.sort(
        (a, b) => new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime(),
      )[0];
      this.remove(oldest.id);
    }

    const session: GatewaySession = {
      id: crypto.randomUUID(),
      userId,
      platform,
      channelId,
      connectedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      metadata: {},
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): GatewaySession | undefined {
    return this.sessions.get(sessionId);
  }

  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
    }
  }

  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getByUser(userId: string): GatewaySession[] {
    return [...this.sessions.values()].filter(s => s.userId === userId);
  }

  getByPlatform(platform: ChatPlatform): GatewaySession[] {
    return [...this.sessions.values()].filter(s => s.platform === platform);
  }

  getAll(): GatewaySession[] {
    return [...this.sessions.values()];
  }

  get count(): number {
    return this.sessions.size;
  }

  startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions) {
        if (now - new Date(session.lastActiveAt).getTime() > this.sessionTimeout) {
          this.sessions.delete(id);
        }
      }
    }, 60_000); // Check every minute
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
