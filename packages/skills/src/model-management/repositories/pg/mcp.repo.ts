import type { Pool } from 'pg';
import type { MCPServerConfig, MCPToolRecord, MCPDomain, MCPTransport, MCPServerStatus } from '../../types/index.js';

export class MCPRepository {
  constructor(private pool: Pool) {}

  async create(data: {
    name: string;
    description?: string;
    domain: MCPDomain;
    transport: MCPTransport;
    command?: string;
    url?: string;
    encryptedEnv?: Buffer;
    encryptionIv?: Buffer;
    encryptionTag?: Buffer;
    enabled?: boolean;
    autoConnect?: boolean;
    presetName?: string;
  }): Promise<MCPServerConfig> {
    const { rows } = await this.pool.query(
      `INSERT INTO mcp_servers
         (name, description, domain, transport, command, url, encrypted_env,
          encryption_iv, encryption_tag, enabled, auto_connect, preset_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.name, data.description ?? null, data.domain, data.transport,
        data.command ?? null, data.url ?? null,
        data.encryptedEnv ?? null, data.encryptionIv ?? null, data.encryptionTag ?? null,
        data.enabled ?? true, data.autoConnect ?? true, data.presetName ?? null,
      ],
    );
    return this.mapRow(rows[0]);
  }

  async list(filters?: { domain?: MCPDomain; enabled?: boolean }): Promise<MCPServerConfig[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.domain) { conditions.push(`domain = $${idx++}`); params.push(filters.domain); }
    if (filters?.enabled !== undefined) { conditions.push(`enabled = $${idx++}`); params.push(filters.enabled); }

    const { rows } = await this.pool.query(
      `SELECT * FROM mcp_servers WHERE ${conditions.join(' AND ')} ORDER BY domain, name`,
      params,
    );
    return rows.map(r => this.mapRow(r));
  }

  async getById(id: string): Promise<MCPServerConfig | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM mcp_servers WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async getByName(name: string): Promise<MCPServerConfig | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM mcp_servers WHERE name = $1 AND deleted_at IS NULL`,
      [name],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async updateStatus(id: string, status: MCPServerStatus, lastError?: string, toolCount?: number): Promise<void> {
    await this.pool.query(
      `UPDATE mcp_servers SET status = $2, last_error = $3, tool_count = COALESCE($4, tool_count),
         last_health_check = NOW() WHERE id = $1`,
      [id, status, lastError ?? null, toolCount ?? null],
    );
  }

  async toggle(id: string, enabled: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE mcp_servers SET enabled = $2 WHERE id = $1`,
      [id, enabled],
    );
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE mcp_servers SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async upsertTools(serverId: string, tools: Array<{ toolName: string; bridgedName: string; description?: string; inputSchema: Record<string, unknown> }>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Remove existing tools for this server
      await client.query(`DELETE FROM mcp_tools WHERE server_id = $1`, [serverId]);
      // Insert new tools
      for (const tool of tools) {
        await client.query(
          `INSERT INTO mcp_tools (server_id, tool_name, bridged_name, description, input_schema)
           VALUES ($1, $2, $3, $4, $5)`,
          [serverId, tool.toolName, tool.bridgedName, tool.description ?? null, JSON.stringify(tool.inputSchema)],
        );
      }
      // Update tool count
      await client.query(`UPDATE mcp_servers SET tool_count = $2 WHERE id = $1`, [serverId, tools.length]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getTools(serverId: string): Promise<MCPToolRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM mcp_tools WHERE server_id = $1 ORDER BY tool_name`,
      [serverId],
    );
    return rows.map(r => ({
      id: r.id,
      serverId: r.server_id,
      toolName: r.tool_name,
      bridgedName: r.bridged_name,
      description: r.description,
      inputSchema: r.input_schema,
      invocationCount: r.invocation_count,
      discoveredAt: r.discovered_at.toISOString(),
    }));
  }

  async getAutoConnectServers(): Promise<MCPServerConfig[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM mcp_servers WHERE enabled = true AND auto_connect = true AND deleted_at IS NULL`,
    );
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): MCPServerConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      domain: row.domain as MCPDomain,
      transport: row.transport as MCPTransport,
      command: row.command as string | undefined,
      url: row.url as string | undefined,
      enabled: row.enabled as boolean,
      autoConnect: row.auto_connect as boolean,
      status: row.status as MCPServerStatus,
      lastError: row.last_error as string | undefined,
      presetName: row.preset_name as string | undefined,
      toolCount: row.tool_count as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}
