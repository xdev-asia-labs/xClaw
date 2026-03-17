// ============================================================
// CLI: xclaw gateway - Start the Gateway control plane
// ============================================================

import { Command } from 'commander';
import dotenv from 'dotenv';

export const gatewayCommand = new Command('gateway')
  .description('Start the xClaw Gateway (WebSocket control plane)')
  .option('-p, --port <port>', 'Gateway port', '18789')
  .option('-h, --host <host>', 'Gateway host', '127.0.0.1')
  .option('--cors <origins>', 'CORS origins (comma-separated)', 'http://localhost:3000')
  .action(async (opts) => {
    dotenv.config();

    const { Agent } = await import('@xclaw/core');
    const { Gateway } = await import('@xclaw/gateway');
    const { programmingSkill, healthcareSkill } = await import('@xclaw/skills');

    console.log('Starting xClaw Gateway...\n');

    const agent = new Agent({
      id: 'xclaw-main',
      name: process.env.AGENT_NAME ?? 'xClaw',
      persona: process.env.AGENT_PERSONA ?? 'A helpful AI assistant.',
      systemPrompt: process.env.AGENT_SYSTEM_PROMPT ??
        'You are xClaw, an intelligent AI agent with programming and healthcare tools. Use tools when appropriate. Be helpful, accurate, and safety-conscious.',
      llm: {
        provider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'ollama') ?? 'openai',
        model: process.env.LLM_MODEL ?? 'gpt-4o',
        apiKey: process.env.LLM_API_KEY ?? '',
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
    });

    // Register skills
    await agent.skills.register(programmingSkill);
    await agent.skills.register(healthcareSkill);
    await agent.skills.activate('programming');
    await agent.skills.activate('healthcare');

    const gateway = new Gateway(agent, {
      port: parseInt(opts.port),
      host: opts.host,
      corsOrigins: opts.cors.split(',').map((s: string) => s.trim()),
    });

    await gateway.start();

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down Gateway...');
      await gateway.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
