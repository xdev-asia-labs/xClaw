// ============================================================
// CLI: xclaw chat - Send a message to the agent via Gateway WS
// ============================================================

import { Command } from 'commander';
import WebSocket from 'ws';

export const chatCommand = new Command('chat')
  .description('Chat with the xClaw agent')
  .argument('<message>', 'Message to send')
  .option('-u, --url <url>', 'Gateway WebSocket URL', 'ws://127.0.0.1:18789/ws')
  .option('-s, --session <id>', 'Session ID')
  .action(async (message: string, opts) => {
    const ws = new WebSocket(opts.url);
    const sessionId = opts.session ?? crypto.randomUUID();

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'chat',
        id: crypto.randomUUID(),
        payload: { message, chatSessionId: sessionId },
        timestamp: new Date().toISOString(),
      }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'chat:response') {
        console.log(`\n${msg.payload.content}\n`);
        ws.close();
      } else if (msg.type === 'error') {
        console.error(`Error: ${msg.payload.error}`);
        ws.close(1000);
        process.exit(1);
      }
      // Ignore ping/event messages
    });

    ws.on('error', (err) => {
      console.error(`Connection error: ${err.message}`);
      console.error('Is the Gateway running? Start it with: xclaw gateway');
      process.exit(1);
    });

    ws.on('close', () => process.exit(0));
  });
