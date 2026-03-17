// ============================================================
// Skill Config Store - Persist skill configs to disk (JSON)
// ============================================================

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export interface SkillConfigEntry {
  skillId: string;
  config: Record<string, unknown>;
  toolStates: Record<string, boolean>;  // toolName → enabled
  installedAt: string;
  lastUsedAt?: string;
  invocationCount: number;
  source: 'built-in' | 'npm' | 'url' | 'upload';
  sourceUrl?: string;
}

export class SkillConfigStore {
  private entries: Map<string, SkillConfigEntry> = new Map();
  private filePath: string;
  private dirty = false;

  constructor(dataDir?: string) {
    const baseDir = dataDir ?? join(process.cwd(), 'data');
    this.filePath = join(baseDir, 'skill-configs.json');
  }

  /** Load all saved configs from disk */
  async load(): Promise<void> {
    try {
      if (!existsSync(this.filePath)) return;
      const raw = await readFile(this.filePath, 'utf-8');
      const data: SkillConfigEntry[] = JSON.parse(raw);
      for (const entry of data) {
        this.entries.set(entry.skillId, entry);
      }
      console.log(`[SkillConfigStore] Loaded ${this.entries.size} skill configs`);
    } catch {
      console.warn('[SkillConfigStore] Could not load configs, starting fresh');
    }
  }

  /** Save all configs to disk */
  async save(): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const data = [...this.entries.values()];
    await writeFile(this.filePath, JSON.stringify(data, null, 2));
    this.dirty = false;
  }

  /** Get config for a skill */
  get(skillId: string): SkillConfigEntry | undefined {
    return this.entries.get(skillId);
  }

  /** Get all entries */
  getAll(): SkillConfigEntry[] {
    return [...this.entries.values()];
  }

  /** Set or update a skill config */
  async set(skillId: string, partial: Partial<SkillConfigEntry>): Promise<SkillConfigEntry> {
    const existing = this.entries.get(skillId);
    const entry: SkillConfigEntry = {
      skillId,
      config: partial.config ?? existing?.config ?? {},
      toolStates: partial.toolStates ?? existing?.toolStates ?? {},
      installedAt: existing?.installedAt ?? new Date().toISOString(),
      lastUsedAt: partial.lastUsedAt ?? existing?.lastUsedAt,
      invocationCount: partial.invocationCount ?? existing?.invocationCount ?? 0,
      source: partial.source ?? existing?.source ?? 'built-in',
      sourceUrl: partial.sourceUrl ?? existing?.sourceUrl,
    };
    this.entries.set(skillId, entry);
    this.dirty = true;
    await this.save();
    return entry;
  }

  /** Update just the config for a skill */
  async setConfig(skillId: string, config: Record<string, unknown>): Promise<void> {
    await this.set(skillId, { config });
  }

  /** Toggle a tool on/off */
  async setToolState(skillId: string, toolName: string, enabled: boolean): Promise<void> {
    const entry = this.entries.get(skillId);
    if (!entry) return;
    entry.toolStates[toolName] = enabled;
    this.dirty = true;
    await this.save();
  }

  /** Get tool states for a skill */
  getToolStates(skillId: string): Record<string, boolean> {
    return this.entries.get(skillId)?.toolStates ?? {};
  }

  /** Record a tool invocation */
  async recordInvocation(skillId: string): Promise<void> {
    const entry = this.entries.get(skillId);
    if (!entry) return;
    entry.invocationCount++;
    entry.lastUsedAt = new Date().toISOString();
    // Batch save — don't save every single invocation
    if (entry.invocationCount % 10 === 0) {
      await this.save();
    }
  }

  /** Remove a skill config */
  async remove(skillId: string): Promise<void> {
    this.entries.delete(skillId);
    await this.save();
  }

  /** Check if a skill is installed */
  isInstalled(skillId: string): boolean {
    return this.entries.has(skillId);
  }
}
