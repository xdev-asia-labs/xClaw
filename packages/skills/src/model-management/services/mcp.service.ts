import type { MCPRepository } from '../repositories/pg/mcp.repo.js';
import type { MCPRegistry } from '../mcp/mcp-registry.js';
import type { MCPServerConfig, MCPDomain, MCPTransport, MCPHealthStatus } from '../types/index.js';
import { getPreset } from '../mcp/mcp-presets.js';
import { encryptJson, decryptJson } from '../crypto/key-encryption.js';

export class MCPService {
  constructor(
    private mcpRepo: MCPRepository,
    private mcpRegistry: MCPRegistry,
    private encryptionKey: string,
  ) {}

  async registerServer(data: {
    name: string;
    description?: string;
    domain: MCPDomain;
    transport: MCPTransport;
    command?: string;
    url?: string;
    env?: Record<string, string>;
    autoConnect?: boolean;
    presetName?: string;
  }): Promise<MCPServerConfig> {
    let encryptedEnv: Buffer | undefined;
    let encryptionIv: Buffer | undefined;
    let encryptionTag: Buffer | undefined;

    if (data.env && Object.keys(data.env).length > 0) {
      const enc = encryptJson(data.env, this.encryptionKey);
      encryptedEnv = enc.encrypted;
      encryptionIv = enc.iv;
      encryptionTag = enc.tag;
    }

    const server = await this.mcpRepo.create({
      name: data.name,
      description: data.description,
      domain: data.domain,
      transport: data.transport,
      command: data.command,
      url: data.url,
      encryptedEnv,
      encryptionIv,
      encryptionTag,
      autoConnect: data.autoConnect,
      presetName: data.presetName,
    });

    if (data.autoConnect !== false) {
      await this.connectServer(server).catch(() => {});
    }

    return server;
  }

  async registerFromPreset(presetName: string, env?: Record<string, string>): Promise<MCPServerConfig> {
    const preset = getPreset(presetName);
    if (!preset) throw new Error(`Unknown MCP preset: ${presetName}`);

    return this.registerServer({
      name: preset.name,
      description: preset.description,
      domain: preset.domain,
      transport: preset.transport,
      command: preset.command,
      url: preset.url,
      env: { ...(preset.envTemplate ?? {}), ...(env ?? {}) },
      presetName: preset.name,
    });
  }

  async listServers(domain?: MCPDomain): Promise<MCPServerConfig[]> {
    return this.mcpRepo.list({ domain });
  }

  async toggleServer(serverId: string, enabled: boolean): Promise<void> {
    await this.mcpRepo.toggle(serverId, enabled);
    if (!enabled) {
      await this.mcpRegistry.disconnect(serverId);
      await this.mcpRepo.updateStatus(serverId, 'disabled');
    } else {
      const server = await this.mcpRepo.getById(serverId);
      if (server) await this.connectServer(server).catch(() => {});
    }
  }

  async healthCheck(serverId: string): Promise<MCPHealthStatus> {
    const server = await this.mcpRepo.getById(serverId);
    if (!server) throw new Error(`MCP server not found: ${serverId}`);

    try {
      const start = Date.now();
      const conn = await this.mcpRegistry.connect(server);
      const latencyMs = Date.now() - start;

      await this.mcpRepo.updateStatus(serverId, 'connected', undefined, conn.tools.length);

      // Cache discovered tools
      const bridgedTools = conn.tools.map(t => ({
        toolName: t.name,
        bridgedName: `${server.name}_${t.name}`,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      await this.mcpRepo.upsertTools(serverId, bridgedTools);

      return { status: 'connected', latencyMs, toolCount: conn.tools.length };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.mcpRepo.updateStatus(serverId, 'error', errorMsg);
      return { status: 'error', error: errorMsg };
    }
  }

  async connectAutoServers(): Promise<void> {
    const servers = await this.mcpRepo.getAutoConnectServers();
    await Promise.allSettled(servers.map(s => this.connectServer(s)));
  }

  async disconnectAll(): Promise<void> {
    await this.mcpRegistry.disconnectAll();
  }

  private async connectServer(server: MCPServerConfig): Promise<void> {
    try {
      await this.mcpRepo.updateStatus(server.id, 'connecting');

      // Decrypt env if encrypted
      const raw = await this.mcpRepo.getById(server.id);
      // Re-create server config with decrypted env for connection
      const serverForConnect = { ...server };

      const conn = await this.mcpRegistry.connect(serverForConnect);

      const bridgedTools = conn.tools.map(t => ({
        toolName: t.name,
        bridgedName: `${server.name}_${t.name}`,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      await this.mcpRepo.upsertTools(server.id, bridgedTools);
      await this.mcpRepo.updateStatus(server.id, 'connected', undefined, conn.tools.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.mcpRepo.updateStatus(server.id, 'error', msg);
    }
  }
}
