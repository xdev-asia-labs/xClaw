// ============================================================
// Skill Manager - Load, register, and manage skill plugins
// ============================================================

import type { SkillManifest, SkillConfigField, ToolDefinition } from '@xclaw/shared';
import { ToolRegistry, type ToolExecutor } from '../tools/tool-registry.js';
import { EventBus } from '../agent/event-bus.js';
import { SkillConfigStore } from './skill-config-store.js';

export interface SkillPlugin {
  manifest: SkillManifest;
  activate(context: SkillContext): Promise<void>;
  deactivate?(): Promise<void>;
}

export interface SkillContext {
  toolRegistry: ToolRegistry;
  eventBus: EventBus;
  config: Record<string, unknown>;
  log: (message: string) => void;
}

export class SkillManager {
  private skills: Map<string, SkillPlugin> = new Map();
  private configs: Map<string, Record<string, unknown>> = new Map();
  private activeSkills: Set<string> = new Set();
  private disabledTools: Map<string, Set<string>> = new Map();
  private configStore?: SkillConfigStore;

  constructor(
    private toolRegistry: ToolRegistry,
    private eventBus: EventBus,
  ) {}

  /** Attach a config store for persistence */
  setConfigStore(store: SkillConfigStore): void {
    this.configStore = store;
  }

  getConfigStore(): SkillConfigStore | undefined {
    return this.configStore;
  }

  async register(plugin: SkillPlugin): Promise<void> {
    this.skills.set(plugin.manifest.id, plugin);
    await this.eventBus.emit({
      type: 'skill:registered',
      payload: { skillId: plugin.manifest.id, name: plugin.manifest.name },
      source: 'skill-manager',
      timestamp: new Date().toISOString(),
    });
  }

  async activate(skillId: string, config?: Record<string, unknown>): Promise<void> {
    const plugin = this.skills.get(skillId);
    if (!plugin) throw new Error(`Skill not found: ${skillId}`);
    if (this.activeSkills.has(skillId)) return;

    if (config) this.configs.set(skillId, config);

    const context: SkillContext = {
      toolRegistry: this.toolRegistry,
      eventBus: this.eventBus,
      config: this.configs.get(skillId) ?? {},
      log: (msg: string) => console.log(`[skill:${skillId}] ${msg}`),
    };

    await plugin.activate(context);
    this.activeSkills.add(skillId);

    await this.eventBus.emit({
      type: 'skill:activated',
      payload: { skillId, name: plugin.manifest.name },
      source: 'skill-manager',
      timestamp: new Date().toISOString(),
    });
  }

  async deactivate(skillId: string): Promise<void> {
    const plugin = this.skills.get(skillId);
    if (!plugin || !this.activeSkills.has(skillId)) return;

    if (plugin.deactivate) await plugin.deactivate();

    // Unregister tools
    for (const tool of plugin.manifest.tools) {
      this.toolRegistry.unregister(tool.name);
    }

    this.activeSkills.delete(skillId);
  }

  getManifest(skillId: string): SkillManifest | undefined {
    return this.skills.get(skillId)?.manifest;
  }

  listAll(): SkillManifest[] {
    return [...this.skills.values()].map(s => s.manifest);
  }

  listActive(): SkillManifest[] {
    return [...this.skills.values()]
      .filter(s => this.activeSkills.has(s.manifest.id))
      .map(s => s.manifest);
  }

  isActive(skillId: string): boolean {
    return this.activeSkills.has(skillId);
  }

  // ─── Config Management ──────────────────────────────────

  getConfig(skillId: string): Record<string, unknown> {
    return this.configs.get(skillId) ?? {};
  }

  async setConfig(skillId: string, config: Record<string, unknown>): Promise<void> {
    this.configs.set(skillId, config);
    if (this.configStore) {
      await this.configStore.setConfig(skillId, config);
    }
    await this.eventBus.emit({
      type: 'skill:config-changed',
      payload: { skillId, config },
      source: 'skill-manager',
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Tool Toggle ────────────────────────────────────────

  getToolsState(skillId: string): Record<string, boolean> {
    const plugin = this.skills.get(skillId);
    if (!plugin) return {};
    const disabled = this.disabledTools.get(skillId) ?? new Set();
    const states: Record<string, boolean> = {};
    for (const tool of plugin.manifest.tools) {
      states[tool.name] = !disabled.has(tool.name);
    }
    return states;
  }

  async toggleTool(skillId: string, toolName: string, enabled: boolean): Promise<void> {
    const plugin = this.skills.get(skillId);
    if (!plugin) return;

    let disabled = this.disabledTools.get(skillId);
    if (!disabled) {
      disabled = new Set();
      this.disabledTools.set(skillId, disabled);
    }

    if (enabled) {
      disabled.delete(toolName);
      // Re-register tool if skill is active
      if (this.activeSkills.has(skillId)) {
        const toolDef = plugin.manifest.tools.find(t => t.name === toolName);
        if (toolDef) {
          // The executor should be stored — for now just emit event
          await this.eventBus.emit({
            type: 'skill:tool-enabled',
            payload: { skillId, toolName },
            source: 'skill-manager',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } else {
      disabled.add(toolName);
      // Unregister tool if skill is active
      if (this.activeSkills.has(skillId)) {
        this.toolRegistry.unregister(toolName);
      }
    }

    // Persist
    if (this.configStore) {
      await this.configStore.setToolState(skillId, toolName, enabled);
    }
  }
}

// ─── Helper to create a skill plugin easily ─────────────────

export function defineSkill(
  manifest: SkillManifest,
  toolImplementations: Record<string, ToolExecutor>,
): SkillPlugin {
  return {
    manifest,
    async activate(context: SkillContext) {
      for (const toolDef of manifest.tools) {
        const executor = toolImplementations[toolDef.name];
        if (executor) {
          context.toolRegistry.register(toolDef, executor);
          context.log(`Registered tool: ${toolDef.name}`);
        }
      }
    },
    async deactivate() {
      // Tools will be unregistered by SkillManager
    },
  };
}
