import type { MCPServerConfig, MCPToolSchema, MCPTransport } from '../types/index.js';

export interface MCPConnection {
  serverId: string;
  serverName: string;
  transport: MCPTransport;
  tools: MCPToolSchema[];
  connected: boolean;
  close: () => Promise<void>;
}

export class MCPClient {
  private stdioTimeoutMs: number;
  private sseTimeoutMs: number;

  constructor(opts: { stdioTimeoutMs?: number; sseTimeoutMs?: number } = {}) {
    this.stdioTimeoutMs = opts.stdioTimeoutMs ?? 30000;
    this.sseTimeoutMs = opts.sseTimeoutMs ?? 30000;
  }

  async connect(server: MCPServerConfig): Promise<MCPConnection> {
    switch (server.transport) {
      case 'stdio':
        return this.connectStdio(server);
      case 'sse':
      case 'streamable-http':
        return this.connectHttp(server);
      default:
        throw new Error(`Unsupported transport: ${server.transport}`);
    }
  }

  private async connectStdio(server: MCPServerConfig): Promise<MCPConnection> {
    if (!server.command) throw new Error(`MCP server ${server.name}: stdio transport requires 'command'`);

    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const parts = server.command.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...(server.env ?? {}) } as Record<string, string>,
    });

    const client = new Client({ name: `autox-${server.name}`, version: '1.0.0' });

    const timeoutId = setTimeout(() => {
      transport.close?.();
    }, this.stdioTimeoutMs);

    try {
      await client.connect(transport);
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to connect to MCP server ${server.name}: ${err}`);
    }

    const { tools: rawTools } = await client.listTools();
    const tools: MCPToolSchema[] = (rawTools ?? []).map(t => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }));

    return {
      serverId: server.id,
      serverName: server.name,
      transport: server.transport,
      tools,
      connected: true,
      close: async () => {
        await client.close();
      },
    };
  }

  private async connectHttp(server: MCPServerConfig): Promise<MCPConnection> {
    if (!server.url) throw new Error(`MCP server ${server.name}: HTTP transport requires 'url'`);

    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');

    const transport = new SSEClientTransport(new URL(server.url));
    const client = new Client({ name: `autox-${server.name}`, version: '1.0.0' });

    const timeoutId = setTimeout(() => {
      transport.close?.();
    }, this.sseTimeoutMs);

    try {
      await client.connect(transport);
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to connect to MCP server ${server.name}: ${err}`);
    }

    const { tools: rawTools } = await client.listTools();
    const tools: MCPToolSchema[] = (rawTools ?? []).map(t => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }));

    return {
      serverId: server.id,
      serverName: server.name,
      transport: server.transport,
      tools,
      connected: true,
      close: async () => {
        await client.close();
      },
    };
  }
}
