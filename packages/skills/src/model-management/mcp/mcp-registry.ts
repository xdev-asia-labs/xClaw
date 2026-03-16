import type { MCPClient, MCPConnection } from './mcp-client.js';
import type { MCPServerConfig, MCPToolSchema } from '../types/index.js';

export class MCPRegistry {
  private connections = new Map<string, MCPConnection>();
  private maxServers: number;

  constructor(private client: MCPClient, maxServers = 20) {
    this.maxServers = maxServers;
  }

  async connect(server: MCPServerConfig): Promise<MCPConnection> {
    if (this.connections.size >= this.maxServers) {
      throw new Error(`Maximum MCP servers (${this.maxServers}) reached`);
    }

    const existing = this.connections.get(server.id);
    if (existing?.connected) return existing;

    const conn = await this.client.connect(server);
    this.connections.set(server.id, conn);
    return conn;
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (conn) {
      await conn.close();
      this.connections.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    const promises = [...this.connections.values()].map(c => c.close().catch(() => {}));
    await Promise.all(promises);
    this.connections.clear();
  }

  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId);
  }

  getAllConnections(): MCPConnection[] {
    return [...this.connections.values()];
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.connected ?? false;
  }

  getToolsForServer(serverId: string): MCPToolSchema[] {
    return this.connections.get(serverId)?.tools ?? [];
  }

  getAllTools(): Array<MCPToolSchema & { serverId: string; serverName: string }> {
    const allTools: Array<MCPToolSchema & { serverId: string; serverName: string }> = [];
    for (const conn of this.connections.values()) {
      for (const tool of conn.tools) {
        allTools.push({ ...tool, serverId: conn.serverId, serverName: conn.serverName });
      }
    }
    return allTools;
  }

  get connectedCount(): number {
    return this.connections.size;
  }
}
