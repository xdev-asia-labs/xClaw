import type { MCPService } from '../services/mcp.service.js';
import type { MCPDomain, MCPTransport } from '../types/index.js';

export function createMCPTools(mcpService: MCPService) {
  return {
    mcp_register: async (args: Record<string, unknown>) => {
      const presetName = args.preset_name as string | undefined;
      if (presetName) {
        const env = args.env as Record<string, string> | undefined;
        const server = await mcpService.registerFromPreset(presetName, env);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, server }, null, 2) }] };
      }

      const name = args.name as string;
      const domain = args.domain as MCPDomain;
      const transport = args.transport as MCPTransport;
      if (!name || !domain || !transport) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: name, domain, transport' }], isError: true };
      }

      const server = await mcpService.registerServer({
        name,
        description: args.description as string | undefined,
        domain,
        transport,
        command: args.command as string | undefined,
        url: args.url as string | undefined,
        env: args.env as Record<string, string> | undefined,
        autoConnect: args.auto_connect as boolean | undefined,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, server }, null, 2) }] };
    },

    mcp_list: async (args: Record<string, unknown>) => {
      const domain = args.domain as MCPDomain | undefined;
      const servers = await mcpService.listServers(domain);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ total: servers.length, servers }, null, 2) }],
      };
    },

    mcp_toggle: async (args: Record<string, unknown>) => {
      const serverId = args.server_id as string;
      const enabled = args.enabled as boolean;
      if (!serverId || enabled === undefined) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: server_id, enabled' }], isError: true };
      }

      await mcpService.toggleServer(serverId, enabled);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, serverId, enabled }, null, 2) }],
      };
    },

    mcp_health: async (args: Record<string, unknown>) => {
      const serverId = args.server_id as string;
      if (!serverId) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: server_id' }], isError: true };
      }

      const health = await mcpService.healthCheck(serverId);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(health, null, 2) }],
      };
    },
  };
}
