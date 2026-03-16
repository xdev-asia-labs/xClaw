import type { MCPPreset, MCPDomain, MCPTransport } from '../types/index.js';

export const MCP_PRESETS: MCPPreset[] = [
  // ── Code domain ─────────────────────────────────────────
  {
    name: 'filesystem',
    domain: 'code',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-filesystem',
    description: 'File system access (read/write/list/search files)',
    envTemplate: {},
  },
  {
    name: 'github',
    domain: 'code',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-github',
    description: 'GitHub API access (repos, issues, PRs, code search)',
    envTemplate: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
  },

  // ── Web domain ──────────────────────────────────────────
  {
    name: 'brave-search',
    domain: 'web',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-brave-search',
    description: 'Web search via Brave Search API',
    envTemplate: { BRAVE_API_KEY: '' },
  },
  {
    name: 'fetch',
    domain: 'web',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-fetch',
    description: 'Fetch web pages and extract content',
    envTemplate: {},
  },

  // ── Data domain ─────────────────────────────────────────
  {
    name: 'postgres',
    domain: 'data',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-postgres',
    description: 'PostgreSQL database access',
    envTemplate: { POSTGRES_CONNECTION_STRING: '' },
  },
  {
    name: 'sqlite',
    domain: 'data',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-sqlite',
    description: 'SQLite database access',
    envTemplate: {},
  },

  // ── Productivity domain ─────────────────────────────────
  {
    name: 'google-drive',
    domain: 'productivity',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-gdrive',
    description: 'Google Drive file access and search',
    envTemplate: {},
  },
  {
    name: 'slack',
    domain: 'productivity',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-slack',
    description: 'Slack workspace interaction',
    envTemplate: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' },
  },

  // ── Knowledge domain ────────────────────────────────────
  {
    name: 'memory',
    domain: 'knowledge',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-memory',
    description: 'Persistent knowledge graph memory',
    envTemplate: {},
  },

  // ── DevOps domain ───────────────────────────────────────
  {
    name: 'docker',
    domain: 'devops',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-docker',
    description: 'Docker container management',
    envTemplate: {},
  },

  // ── Media domain ────────────────────────────────────────
  {
    name: 'puppeteer',
    domain: 'media',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-puppeteer',
    description: 'Browser automation and screenshots',
    envTemplate: {},
  },
];

export function getPreset(name: string): MCPPreset | undefined {
  return MCP_PRESETS.find(p => p.name === name);
}

export function getPresetsByDomain(domain: MCPDomain): MCPPreset[] {
  return MCP_PRESETS.filter(p => p.domain === domain);
}
