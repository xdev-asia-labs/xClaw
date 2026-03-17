// ============================================================
// SkillHub Service — Central orchestrator for marketplace ops
// ============================================================

import { randomUUID } from 'node:crypto';
import type {
  HubSkillEntry,
  HubSearchParams,
  HubSearchResult,
  SkillReview,
  SkillSubmission,
  SkillManifest,
  AnthropicSkill,
  SubmissionStatus,
} from '@xclaw/shared';
import type { SkillManager, SkillPlugin } from '@xclaw/core';
import { SkillHubStore } from './hub-store.js';
import { AnthropicAdapter } from './adapters/anthropic-adapter.js';
import { McpAdapter } from './adapters/mcp-adapter.js';

export interface SkillHubConfig {
  dataDir?: string;
  githubToken?: string;
}

export class SkillHubService {
  private store: SkillHubStore;
  private anthropic: AnthropicAdapter;
  private mcp: McpAdapter;
  private skillManager?: SkillManager;
  private initialized = false;

  constructor(config?: SkillHubConfig) {
    this.store = new SkillHubStore(config?.dataDir);
    this.anthropic = new AnthropicAdapter(config?.githubToken);
    this.mcp = new McpAdapter();
  }

  /**
   * Wire up with xClaw's SkillManager for install/activate integration
   */
  setSkillManager(manager: SkillManager): void {
    this.skillManager = manager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.store.load();
    this.initialized = true;
  }

  // ─── Discovery ───────────────────────────────────────────

  async search(params: HubSearchParams): Promise<HubSearchResult> {
    await this.initialize();
    return this.store.search(params);
  }

  async getSkill(id: string): Promise<HubSkillEntry | undefined> {
    await this.initialize();
    return this.store.getSkill(id);
  }

  async getFeatured(): Promise<HubSkillEntry[]> {
    await this.initialize();
    return this.store.getFeatured();
  }

  async getTrending(): Promise<HubSkillEntry[]> {
    await this.initialize();
    return this.store.getTrending();
  }

  async getStats(): Promise<{ total: number; bySource: Record<string, number>; byCategory: Record<string, number> }> {
    await this.initialize();
    return this.store.getHubStats();
  }

  // ─── Installation ────────────────────────────────────────

  /**
   * Install a skill from the SkillHub registry and register it with SkillManager
   */
  async installSkill(skillId: string): Promise<{ success: boolean; message: string }> {
    await this.initialize();

    const entry = this.store.getSkill(skillId);
    if (!entry) {
      return { success: false, message: `Skill not found: ${skillId}` };
    }

    if (!this.skillManager) {
      return { success: false, message: 'SkillManager not connected' };
    }

    try {
      // Create a SkillPlugin from the manifest
      const plugin = this.createPluginFromEntry(entry);
      await this.skillManager.register(plugin);
      await this.store.incrementInstalls(skillId);

      return { success: true, message: `Installed: ${entry.name} v${entry.version}` };
    } catch (err) {
      return { success: false, message: `Install failed: ${(err as Error).message}` };
    }
  }

  /**
   * Uninstall a skill from the SkillManager
   */
  async uninstallSkill(skillId: string): Promise<{ success: boolean; message: string }> {
    await this.initialize();

    if (!this.skillManager) {
      return { success: false, message: 'SkillManager not connected' };
    }

    const entry = this.store.getSkill(skillId);
    if (!entry) {
      return { success: false, message: `Skill not found: ${skillId}` };
    }

    try {
      const manifestId = entry.manifest.id;
      if (this.skillManager.isActive(manifestId)) {
        await this.skillManager.deactivate(manifestId);
      }
      await this.store.decrementActiveInstalls(skillId);
      return { success: true, message: `Uninstalled: ${entry.name}` };
    } catch (err) {
      return { success: false, message: `Uninstall failed: ${(err as Error).message}` };
    }
  }

  // ─── Anthropic Import ────────────────────────────────────

  /**
   * List all available skills from Anthropic's repository
   */
  async listAnthropicSkills(): Promise<AnthropicSkill[]> {
    return this.anthropic.listAvailableSkills();
  }

  /**
   * Import a specific skill from Anthropic's repository
   */
  async importAnthropicSkill(skillName: string): Promise<{ success: boolean; entry?: HubSkillEntry; message: string }> {
    await this.initialize();

    try {
      const entry = await this.anthropic.importSkill(skillName);
      if (!entry) {
        return { success: false, message: `Skill not found in Anthropic repo: ${skillName}` };
      }

      await this.store.addSkill(entry);
      return { success: true, entry, message: `Imported: ${entry.name} from Anthropic` };
    } catch (err) {
      return { success: false, message: `Import failed: ${(err as Error).message}` };
    }
  }

  /**
   * Import all skills from Anthropic's repository
   */
  async importAllAnthropicSkills(): Promise<{ imported: number; failed: number; entries: HubSkillEntry[] }> {
    await this.initialize();

    try {
      const entries = await this.anthropic.importAll();
      let imported = 0;
      let failed = 0;

      for (const entry of entries) {
        try {
          await this.store.addSkill(entry);
          imported++;
        } catch {
          failed++;
        }
      }

      return { imported, failed, entries };
    } catch (err) {
      return { imported: 0, failed: 0, entries: [] };
    }
  }

  /**
   * Check for updates in Anthropic skills
   */
  async checkAnthropicUpdates(): Promise<{ skillId: string; hasUpdate: boolean }[]> {
    await this.initialize();
    const anthropicSkills = this.store.getBySource('anthropic');
    return this.anthropic.checkForUpdates(anthropicSkills);
  }

  // ─── MCP Import ──────────────────────────────────────────

  /**
   * Import an MCP server as an xClaw skill
   */
  async importMcpServer(packageName: string): Promise<{ success: boolean; entry?: HubSkillEntry; message: string }> {
    await this.initialize();

    try {
      const serverInfo = await this.mcp.discoverFromPackage(packageName);
      if (!serverInfo) {
        return { success: false, message: `Could not discover MCP server: ${packageName}` };
      }

      const entry = this.mcp.convertToHubEntry(serverInfo, packageName);
      await this.store.addSkill(entry);

      return { success: true, entry, message: `Imported MCP server: ${serverInfo.name}` };
    } catch (err) {
      return { success: false, message: `MCP import failed: ${(err as Error).message}` };
    }
  }

  // ─── User Skill Submission ───────────────────────────────

  /**
   * Submit a user-created skill MANIFEST for review
   */
  async submitSkill(
    manifest: SkillManifest,
    author: { name: string; email?: string },
    readme?: string,
  ): Promise<{ success: boolean; submissionId?: string; message: string }> {
    await this.initialize();

    // Validate manifest
    const validation = this.validateManifest(manifest);
    if (!validation.valid) {
      return { success: false, message: `Validation failed: ${validation.errors.join(', ')}` };
    }

    // Check for duplicates
    const existing = this.store.getSkill(`community/${manifest.id}`);
    if (existing && existing.version === manifest.version) {
      return { success: false, message: `Skill ${manifest.id} v${manifest.version} already exists` };
    }

    const submissionId = randomUUID();
    const now = new Date().toISOString();

    const submission: SkillSubmission = {
      id: submissionId,
      skillId: `community/${manifest.id}`,
      version: manifest.version,
      submittedBy: { name: author.name, email: author.email, verified: false },
      status: 'pending',
      submittedAt: now,
    };

    // Create hub entry (pending)
    const entry: HubSkillEntry = {
      id: `community/${manifest.id}`,
      name: manifest.name,
      slug: manifest.id,
      version: manifest.version,
      description: manifest.description,
      author: { name: author.name, email: author.email, verified: false },
      license: 'MIT',
      category: manifest.category,
      tags: manifest.tags,
      source: 'community',
      manifest,
      readme,
      stats: {
        installs: 0,
        activeInstalls: 0,
        rating: 0,
        reviewCount: 0,
        weeklyDownloads: 0,
      },
      distribution: { type: 'registry' },
      compatible: true,
      featured: false,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    };

    await this.store.addSubmission(submission);
    await this.store.addSkill(entry);

    return { success: true, submissionId, message: `Submitted: ${manifest.name} — pending review` };
  }

  /**
   * Review a submission (approve/reject)
   */
  async reviewSubmission(
    submissionId: string,
    action: 'approved' | 'rejected' | 'needs-changes',
    reviewedBy: string,
    notes?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.initialize();

    const submission = this.store.getSubmission(submissionId);
    if (!submission) {
      return { success: false, message: `Submission not found: ${submissionId}` };
    }

    await this.store.updateSubmission(submissionId, {
      status: action as SubmissionStatus,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    });

    if (action === 'rejected') {
      await this.store.removeSkill(submission.skillId);
    }

    return { success: true, message: `Submission ${action}: ${submission.skillId}` };
  }

  /**
   * Get pending submissions
   */
  async getPendingSubmissions(): Promise<SkillSubmission[]> {
    await this.initialize();
    return this.store.getSubmissions('pending');
  }

  // ─── Reviews ─────────────────────────────────────────────

  async addReview(
    skillId: string,
    userId: string,
    userName: string,
    rating: number,
    title: string,
    body: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.initialize();

    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5' };
    }

    const review: SkillReview = {
      id: randomUUID(),
      skillId,
      userId,
      userName,
      rating,
      title,
      body,
      createdAt: new Date().toISOString(),
      helpful: 0,
    };

    await this.store.addReview(review);
    return { success: true, message: 'Review added' };
  }

  async getReviews(skillId: string): Promise<SkillReview[]> {
    await this.initialize();
    return this.store.getReviews(skillId);
  }

  // ─── Update Check ────────────────────────────────────────

  async checkForUpdates(): Promise<{ skillId: string; currentVersion: string; latestVersion?: string; hasUpdate: boolean }[]> {
    await this.initialize();
    const anthropicUpdates = await this.checkAnthropicUpdates();

    return anthropicUpdates.map(u => ({
      ...u,
      currentVersion: this.store.getSkill(u.skillId)?.version ?? '0.0.0',
    }));
  }

  // ─── Helpers ─────────────────────────────────────────────

  private validateManifest(manifest: SkillManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.id) errors.push('id is required');
    if (!manifest.name) errors.push('name is required');
    if (!manifest.version) errors.push('version is required');
    if (!manifest.description) errors.push('description is required');
    if (!manifest.author) errors.push('author is required');
    if (!manifest.category) errors.push('category is required');
    if (!manifest.tools?.length) errors.push('at least one tool is required');

    // Validate version format
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('version must be semver format (x.y.z)');
    }

    // Validate tool definitions
    for (const tool of manifest.tools ?? []) {
      if (!tool.name) errors.push(`tool name is required`);
      if (!tool.description) errors.push(`tool ${tool.name}: description is required`);
      if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
        errors.push(`tool ${tool.name}: name must be snake_case`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create a SkillPlugin from a HubSkillEntry (for Anthropic prompt-based skills)
   */
  private createPluginFromEntry(entry: HubSkillEntry): SkillPlugin {
    const isPromptBased = entry.source === 'anthropic';

    return {
      manifest: entry.manifest,
      async activate(context) {
        for (const toolDef of entry.manifest.tools) {
          if (isPromptBased && entry.skillMd) {
            // For Anthropic skills: tool returns the skill instructions
            context.toolRegistry.register(toolDef, async (args) => {
              return {
                instructions: entry.skillMd,
                query: (args as Record<string, unknown>).query,
                source: `Anthropic Skill: ${entry.name}`,
              };
            });
          } else {
            // For other skills: placeholder executor
            context.toolRegistry.register(toolDef, async (args) => {
              return {
                message: `Tool ${toolDef.name} from ${entry.name} — implementation pending`,
                args,
              };
            });
          }
          context.log(`Registered hub tool: ${toolDef.name}`);
        }
      },
    };
  }
}
