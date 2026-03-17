// ============================================================
// xClaw Server - Launches the Gateway control plane
// This is a thin entry point that configures and starts Gateway
// ============================================================

import { Agent } from '@xclaw/core';
import { Gateway } from '@xclaw/gateway';
import { programmingSkill, healthcareSkill, modelManagementSkill, getRAGService } from '@xclaw/skills';
import type { AgentConfig } from '@xclaw/shared';
import dotenv from 'dotenv';

dotenv.config();

const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT ?? process.env.PORT ?? '18789');
const GATEWAY_HOST = process.env.GATEWAY_HOST ?? '127.0.0.1';

// ─── Init Agent ─────────────────────────────────────────────

const agentConfig: AgentConfig = {
  id: 'xclaw-main',
  name: process.env.AGENT_NAME ?? 'xClaw',
  persona: process.env.AGENT_PERSONA ?? 'A helpful AI assistant specialized in programming and healthcare.',
  systemPrompt: process.env.AGENT_SYSTEM_PROMPT ??
    `You are xClaw, an intelligent AI agent with many tools available. IMPORTANT: You MUST use tools (function calls) to perform actions. Do NOT write code yourself - instead call the appropriate tool.

Available tool categories:
- Programming: shell_exec, file_read, file_write, git_status, etc.
- Healthcare: symptom_analyze, medication_check_interaction, health_metrics_log, etc.
- Charts/Reports: generate_chart (create charts/graphs), generate_report (statistics), export_chat_pdf (export to PDF)
- Data evaluation: evaluate_learning_data (review learning data quality)
- Knowledge: kb_search, kb_add_document, etc.
- Models: model_list, model_switch, ollama_list, etc.

When a user asks for a chart, statistics, report, or data evaluation, ALWAYS call the corresponding tool. Never generate code as a response when a tool can do the job.`,
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
    pgConnectionString: process.env.PG_CONNECTION_STRING ?? 'postgresql://xclaw:xclaw_secret@localhost:5432/xclaw',
    mongoConnectionString: process.env.MONGO_CONNECTION_STRING ?? 'mongodb://xclaw:xclaw_secret@localhost:27017/xclaw?authSource=admin',
    encryptionKey: process.env.ENCRYPTION_KEY ?? '',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  });

  // Wire RAG context into Agent
  const ragSvc = getRAGService();
  if (ragSvc) {
    agent.setRAGContextProvider((query) => ragSvc.buildContext(query));
    agent.setRAGDetailedProvider((query) => ragSvc.buildContextDetailed(query));
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
    const { TelegramChannel } = await import('@xclaw/channel-telegram');
    await gateway.channels.register(new TelegramChannel(), {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
    });
    console.log('Telegram channel registered');
  }

  if (process.env.DISCORD_BOT_TOKEN) {
    // @ts-ignore — optional channel package, not yet implemented
    const { DiscordChannel } = await import('@xclaw/channel-discord');
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
