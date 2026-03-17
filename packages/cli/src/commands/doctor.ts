// ============================================================
// CLI: xclaw doctor - Diagnose system health
// ============================================================

import { Command } from 'commander';

export const doctorCommand = new Command('doctor')
  .description('Check xClaw system health and configuration')
  .option('--url <url>', 'Gateway REST URL', 'http://127.0.0.1:18789')
  .action(async (opts) => {
    console.log('\nxClaw Doctor\n');
    console.log('Checking system health...\n');

    // Check Node.js version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1));
    const nodeOk = nodeMajor >= 20;
    console.log(`  ${nodeOk ? '✓' : '✗'} Node.js ${nodeVersion} ${nodeOk ? '' : '(requires >= 20)'}`);

    // Check environment variables
    const envVars = ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_API_KEY'];
    for (const key of envVars) {
      const value = process.env[key];
      console.log(`  ${value ? '✓' : '○'} ${key}: ${value ? '***configured***' : 'not set'}`);
    }

    // Check Gateway connectivity
    try {
      const res = await fetch(`${opts.url}/api/health`);
      const data = await res.json() as { status: string; sessions: number; channels: string[] };
      console.log(`  ✓ Gateway: ${data.status} (${data.sessions} sessions, channels: ${data.channels?.join(', ') || 'none'})`);
    } catch {
      console.log('  ✗ Gateway: not reachable (start with: xclaw gateway)');
    }

    // Check skills
    try {
      const res = await fetch(`${opts.url}/api/skills/active`);
      const data = await res.json() as { skills: Array<{ id: string }> };
      console.log(`  ✓ Active skills: ${data.skills.map(s => s.id).join(', ') || 'none'}`);
    } catch {
      console.log('  ○ Skills: cannot check (gateway not running)');
    }

    console.log('\nDone.\n');
  });
