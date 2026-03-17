// ============================================================
// Plugin Loader - Load plugins from npm packages or local dirs
// Reads xclaw.plugin.json manifests (like OpenClaw pattern)
// ============================================================

import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { PluginManifest, PluginType, SkillManifest, ChannelPlugin, KnowledgePackManifest, KnowledgeDataSource } from '@xclaw/shared';

export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  module: unknown;
}

/** Parsed data source ready for consumption */
export interface LoadedDataSource {
  source: KnowledgeDataSource;
  data: unknown;
}

/** A fully loaded knowledge pack */
export interface LoadedKnowledgePack {
  manifest: KnowledgePackManifest;
  path: string;
  dataSources: LoadedDataSource[];
}

export class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private knowledgePacks: Map<string, LoadedKnowledgePack> = new Map();

  /** Load a plugin from a directory containing xclaw.plugin.json */
  async loadFromPath(pluginPath: string): Promise<LoadedPlugin> {
    const absPath = resolve(pluginPath);
    const manifestPath = join(absPath, 'xclaw.plugin.json');

    const raw = await readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(raw);

    this.validateManifest(manifest);

    // Knowledge packs don't need a JS entry — they're pure data
    if (manifest.type === 'knowledge-pack') {
      return this.loadKnowledgePack(absPath, manifest as KnowledgePackManifest);
    }

    const entryPath = join(absPath, manifest.entry);
    const module = await import(entryPath);

    const plugin: LoadedPlugin = { manifest, path: absPath, module };
    this.plugins.set(manifest.name, plugin);
    return plugin;
  }

  /** Load a plugin from an installed npm package */
  async loadFromPackage(packageName: string): Promise<LoadedPlugin> {
    // Resolve the package's directory
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    const pkgDir = pkgJsonPath.replace('/package.json', '');
    return this.loadFromPath(pkgDir);
  }

  // ─── Knowledge Pack Loading ─────────────────────────────

  /** Load a knowledge pack: read all JSON data sources */
  private async loadKnowledgePack(absPath: string, manifest: KnowledgePackManifest): Promise<LoadedPlugin> {
    const dataSources: LoadedDataSource[] = [];

    for (const src of manifest.dataSources ?? []) {
      const filePath = join(absPath, src.file);
      const rawData = await readFile(filePath, 'utf-8');
      dataSources.push({ source: src, data: JSON.parse(rawData) });
    }

    const pack: LoadedKnowledgePack = { manifest, path: absPath, dataSources };
    this.knowledgePacks.set(manifest.name, pack);

    // Also register as a regular plugin (manifest only, no module)
    const plugin: LoadedPlugin = { manifest, path: absPath, module: { dataSources } };
    this.plugins.set(manifest.name, plugin);

    console.log(`[PluginLoader] Knowledge pack loaded: ${manifest.name} (${dataSources.length} data sources)`);
    return plugin;
  }

  /** Get a loaded knowledge pack */
  getKnowledgePack(name: string): LoadedKnowledgePack | undefined {
    return this.knowledgePacks.get(name);
  }

  /** Get all loaded knowledge packs */
  getAllKnowledgePacks(): LoadedKnowledgePack[] {
    return [...this.knowledgePacks.values()];
  }

  /** Get knowledge packs by domain */
  getKnowledgePacksByDomain(domain: string): LoadedKnowledgePack[] {
    return [...this.knowledgePacks.values()].filter(p => p.manifest.domain === domain);
  }

  /** Get a loaded plugin's skill manifest (for skill-type plugins) */
  getSkillManifest(name: string): SkillManifest | undefined {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.manifest.type !== 'skill') return undefined;
    const mod = plugin.module as { default?: SkillManifest; manifest?: SkillManifest };
    return mod.default ?? mod.manifest;
  }

  /** Get a loaded plugin's channel instance (for channel-type plugins) */
  getChannel(name: string): ChannelPlugin | undefined {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.manifest.type !== 'channel') return undefined;
    const mod = plugin.module as { default?: ChannelPlugin; channel?: ChannelPlugin };
    return mod.default ?? mod.channel;
  }

  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): LoadedPlugin[] {
    return [...this.plugins.values()];
  }

  getByType(type: PluginType): LoadedPlugin[] {
    return [...this.plugins.values()].filter(p => p.manifest.type === type);
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name) throw new Error('Plugin manifest missing "name"');
    if (!manifest.version) throw new Error('Plugin manifest missing "version"');
    if (!manifest.type) throw new Error('Plugin manifest missing "type"');

    const validTypes: PluginType[] = ['skill', 'channel', 'integration', 'theme', 'knowledge-pack'];
    if (!validTypes.includes(manifest.type)) {
      throw new Error(`Invalid plugin type: ${manifest.type}`);
    }

    // Knowledge packs don't require entry — they're data-only
    if (manifest.type !== 'knowledge-pack' && !manifest.entry) {
      throw new Error('Plugin manifest missing "entry"');
    }
  }
}
