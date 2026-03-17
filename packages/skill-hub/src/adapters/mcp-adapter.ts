// ============================================================
// MCP Server Adapter — Import MCP servers as xClaw skills
// Wraps an MCP server process into an xClaw SkillPlugin
// ============================================================

import type {
  HubSkillEntry,
  SkillManifest,
  ToolDefinition,
  ToolParameter,
} from '@xclaw/shared';

interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, McpPropertySchema>;
    required?: string[];
  };
}

interface McpPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

interface McpServerInfo {
  name: string;
  version: string;
  tools?: McpToolSchema[];
  resources?: { uri: string; name: string; description?: string }[];
  prompts?: { name: string; description?: string; arguments?: { name: string }[] }[];
}

export class McpAdapter {

  /**
   * Discover tools from an MCP server by reading its package.json
   * and optionally introspecting via stdio
   */
  async discoverFromPackage(packageName: string): Promise<McpServerInfo | null> {
    try {
      // Fetch package info from npm registry
      const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const pkg = await res.json() as Record<string, unknown>;
      const name = (pkg.name as string) ?? packageName;
      const version = (pkg.version as string) ?? '0.0.0';
      const description = (pkg.description as string) ?? '';

      return {
        name,
        version,
        tools: this.inferToolsFromPackageInfo(name, description),
      };
    } catch {
      return null;
    }
  }

  /**
   * Convert MCP server info → xClaw HubSkillEntry
   */
  convertToHubEntry(server: McpServerInfo, packageName: string): HubSkillEntry {
    const id = `mcp/${server.name.replace(/^@/, '').replace(/\//g, '-')}`;
    const manifest = this.buildManifest(server, packageName);
    const now = new Date().toISOString();

    return {
      id,
      name: this.humanizeMcpName(server.name),
      slug: server.name.replace(/^@/, '').replace(/\//g, '-'),
      version: server.version,
      description: `MCP server: ${server.name} — wrapped as xClaw skill`,
      author: {
        name: this.extractAuthor(server.name),
        verified: server.name.startsWith('@modelcontextprotocol/') || server.name.startsWith('@anthropic/'),
      },
      license: 'MIT',
      category: 'programming',
      tags: ['mcp', server.name.replace(/^@/, '').replace(/\//g, '-')],
      source: 'mcp',
      manifest,
      stats: {
        installs: 0,
        activeInstalls: 0,
        rating: 0,
        reviewCount: 0,
        weeklyDownloads: 0,
      },
      distribution: {
        type: 'npm',
        url: `https://www.npmjs.com/package/${server.name}`,
      },
      compatible: true,
      featured: false,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    };
  }

  /**
   * Convert MCP tool schema → xClaw ToolDefinition
   */
  convertTool(mcpTool: McpToolSchema, serverName: string): ToolDefinition {
    const parameters: ToolParameter[] = [];

    if (mcpTool.inputSchema?.properties) {
      const required = new Set(mcpTool.inputSchema.required ?? []);
      for (const [name, schema] of Object.entries(mcpTool.inputSchema.properties)) {
        parameters.push({
          name,
          type: this.mapType(schema.type),
          description: schema.description ?? name,
          required: required.has(name),
          default: schema.default,
          enum: schema.enum,
        });
      }
    }

    return {
      name: `mcp_${mcpTool.name}`,
      description: mcpTool.description ?? `MCP tool: ${mcpTool.name} from ${serverName}`,
      category: 'mcp',
      parameters,
      returns: {
        name: 'result',
        type: 'object',
        description: 'MCP tool execution result',
      },
    };
  }

  // ─── Private ─────────────────────────────────────────────

  private buildManifest(server: McpServerInfo, packageName: string): SkillManifest {
    const tools: ToolDefinition[] = (server.tools ?? []).map(t =>
      this.convertTool(t, server.name)
    );

    // If no tools discovered, add a generic proxy tool
    if (tools.length === 0) {
      tools.push({
        name: `mcp_${server.name.replace(/[^a-z0-9]/gi, '_')}_call`,
        description: `Execute a tool on MCP server: ${server.name}`,
        category: 'mcp',
        parameters: [
          { name: 'tool', type: 'string', description: 'Tool name to call', required: true },
          { name: 'args', type: 'object', description: 'Tool arguments', required: false },
        ],
        returns: { name: 'result', type: 'object', description: 'Tool execution result' },
      });
    }

    return {
      id: `mcp-${server.name.replace(/^@/, '').replace(/\//g, '-')}`,
      name: this.humanizeMcpName(server.name),
      version: server.version,
      description: `MCP server: ${server.name} — wrapped as xClaw skill`,
      author: this.extractAuthor(server.name),
      category: 'programming',
      tags: ['mcp', 'integration'],
      tools,
      config: [
        {
          key: 'mcpPackage',
          label: 'MCP Package',
          type: 'string',
          description: 'npm package name of the MCP server',
          default: packageName,
        },
        {
          key: 'mcpTransport',
          label: 'Transport',
          type: 'select',
          description: 'MCP transport protocol',
          default: 'stdio',
          options: [
            { label: 'stdio', value: 'stdio' },
            { label: 'SSE', value: 'sse' },
          ],
        },
      ],
    };
  }

  private mapType(mcpType: string): ToolParameter['type'] {
    switch (mcpType) {
      case 'string': return 'string';
      case 'number':
      case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return 'array';
      default: return 'object';
    }
  }

  private humanizeMcpName(name: string): string {
    return name
      .replace(/^@[^/]+\//, '')
      .replace(/^(mcp-server-|server-)/, '')
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') + ' (MCP)';
  }

  private extractAuthor(name: string): string {
    if (name.startsWith('@modelcontextprotocol/')) return 'MCP Official';
    if (name.startsWith('@anthropic/')) return 'Anthropic';
    const match = name.match(/^@([^/]+)\//);
    return match ? match[1] : 'Community';
  }

  private inferToolsFromPackageInfo(name: string, description: string): McpToolSchema[] {
    // Without runtime introspection, infer basic tool structure from package name/description
    const cleanName = name.replace(/^@[^/]+\//, '').replace(/^(mcp-server-|server-)/, '');
    return [{
      name: cleanName.replace(/-/g, '_'),
      description: description || `Tools from ${name}`,
    }];
  }
}
