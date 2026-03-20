#!/usr/bin/env node
// ============================================================
// @xclaw/chat-sdk MCP Server — Standalone entry point
// ============================================================
//
// Run:  XCLAW_BASE_URL=https://... XCLAW_TOKEN=... npx @xclaw/chat-sdk mcp
//       node dist/mcp/bin.js
//

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { XClawClient } from '../client.js';
import { createMcpServer } from './server.js';

const baseUrl = process.env['XCLAW_BASE_URL'];
const token = process.env['XCLAW_TOKEN'];

if (!baseUrl) {
    console.error('Error: XCLAW_BASE_URL environment variable is required');
    console.error('Example: XCLAW_BASE_URL=https://api.xclaw.io XCLAW_TOKEN=... npx @xclaw/chat-sdk mcp');
    process.exit(1);
}

const client = new XClawClient({
    baseUrl,
    token,
});

const server = createMcpServer(client);
const transport = new StdioServerTransport();

await server.connect(transport);
