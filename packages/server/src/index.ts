// ============================================================
// AutoX Server - Launches the Gateway control plane
// This is a thin entry point that configures and starts Gateway
// ============================================================

import { Agent } from '@autox/core';
import { Gateway } from '@autox/gateway';
import { programmingSkill, healthcareSkill, modelManagementSkill, getRAGService } from '@autox/skills';
import type { AgentConfig } from '@autox/shared';
import dotenv from 'dotenv';

dotenv.config();

const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT ?? process.env.PORT ?? '18789');
const GATEWAY_HOST = process.env.GATEWAY_HOST ?? '127.0.0.1';

// ─── Init Agent ─────────────────────────────────────────────

const agentConfig: AgentConfig = {
  id: 'autox-main',
  name: process.env.AGENT_NAME ?? 'AutoX',
  persona: process.env.AGENT_PERSONA ?? 'A helpful AI assistant specialized in programming and healthcare.',
  systemPrompt: process.env.AGENT_SYSTEM_PROMPT ??
    `You are AutoX, an intelligent AI agent. You have access to programming tools (shell, files, git, testing) and healthcare tools (symptom analysis, medication management, health metrics). Use tools when appropriate to help the user. Always be helpful, accurate, and safety-conscious.`,
  llm: {
    provider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'ollama') ?? 'openai',
    model: process.env.LLM_MODEL ?? 'gpt-4o',
    apiKey: process.env.LLM_API_KEY ?? '',
    baseUrl: process.env.LLM_BASE_URL || (process.env.LLM_PROVIDER === 'ollama' && process.env.OLLAMA_BASE_URL ? process.env.OLLAMA_BASE_URL + '/v1' : undefined),
    temperature: 0.7,
    maxTokens: 4096,
  },
  enabledSkills: ['programming', 'healthcare'],
  enabledWorkflows: [],
  memory: { enabled: true, maxEntries: 1000 },
  security: {
    requireApprovalForShell: true,
    requireApprovalForNetwork: false,
    sandboxed: false,
  },
  messaging: {
    platforms: ['web', 'api'],
    maxConcurrentSessions: 50,
  },
};

const agent = new Agent(agentConfig);

// ─── Register Skills ────────────────────────────────────────

async function initSkills() {
  await agent.skills.register(programmingSkill);
  await agent.skills.register(healthcareSkill);
  await agent.skills.register(modelManagementSkill);
  await agent.skills.activate('programming');
  await agent.skills.activate('healthcare');
  await agent.skills.activate('model-management', {
    pgConnectionString: process.env.PG_CONNECTION_STRING ?? 'postgresql://autox:autox_secret@localhost:5432/autox',
    mongoConnectionString: process.env.MONGO_CONNECTION_STRING ?? 'mongodb://autox:autox_secret@localhost:27017/autox?authSource=admin',
    encryptionKey: process.env.ENCRYPTION_KEY ?? '',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  });

  // Wire RAG context into Agent
  const ragSvc = getRAGService();
  if (ragSvc) {
    agent.setRAGContextProvider((query) => ragSvc.buildContext(query));
  }

  console.log('Skills activated:', agent.skills.listActive().map(s => s.name).join(', '));
}

// ─── Start Gateway ──────────────────────────────────────────

async function start() {
  await initSkills();

  const gateway = new Gateway(agent, {
    port: GATEWAY_PORT,
    host: GATEWAY_HOST,
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map(s => s.trim()),
  });

  // Optional: Register channel plugins from environment
  if (process.env.TELEGRAM_BOT_TOKEN) {
    // @ts-ignore — optional channel package, not yet implemented
    const { TelegramChannel } = await import('@autox/channel-telegram');
    await gateway.channels.register(new TelegramChannel(), {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
    });
    console.log('Telegram channel registered');
  }

  if (process.env.DISCORD_BOT_TOKEN) {
    // @ts-ignore — optional channel package, not yet implemented
    const { DiscordChannel } = await import('@autox/channel-discord');
    await gateway.channels.register(new DiscordChannel(), {
      botToken: process.env.DISCORD_BOT_TOKEN,
    });
    console.log('Discord channel registered');
  }

  await gateway.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await gateway.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(console.error);
