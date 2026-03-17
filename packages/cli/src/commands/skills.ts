// ============================================================
// CLI: xclaw skills - Manage agent skills
// ============================================================

import { Command } from 'commander';

export const skillsCommand = new Command('skills')
  .description('Manage xClaw skills/plugins');

skillsCommand
  .command('list')
  .description('List all available skills')
  .option('--url <url>', 'Gateway REST URL', 'http://127.0.0.1:18789')
  .action(async (opts) => {
    try {
      const res = await fetch(`${opts.url}/api/skills`);
      const data = await res.json() as { skills: Array<{ id: string; name: string; version: string; category: string; description: string }> };

      console.log('\nAvailable Skills:\n');
      for (const skill of data.skills) {
        console.log(`  ${skill.id}`);
        console.log(`    Name: ${skill.name} v${skill.version}`);
        console.log(`    Category: ${skill.category}`);
        console.log(`    ${skill.description}\n`);
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

skillsCommand
  .command('active')
  .description('List active skills')
  .option('--url <url>', 'Gateway REST URL', 'http://127.0.0.1:18789')
  .action(async (opts) => {
    try {
      const res = await fetch(`${opts.url}/api/skills/active`);
      const data = await res.json() as { skills: Array<{ id: string; name: string }> };
      console.log('\nActive Skills:\n');
      for (const skill of data.skills) {
        console.log(`  ✓ ${skill.id} (${skill.name})`);
      }
      console.log('');
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

skillsCommand
  .command('activate <id>')
  .description('Activate a skill')
  .option('--url <url>', 'Gateway REST URL', 'http://127.0.0.1:18789')
  .action(async (id: string, opts) => {
    try {
      const res = await fetch(`${opts.url}/api/skills/${encodeURIComponent(id)}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        console.log(`Skill "${id}" activated.`);
      } else {
        console.error(`Failed: ${data.error}`);
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

skillsCommand
  .command('deactivate <id>')
  .description('Deactivate a skill')
  .option('--url <url>', 'Gateway REST URL', 'http://127.0.0.1:18789')
  .action(async (id: string, opts) => {
    try {
      const res = await fetch(`${opts.url}/api/skills/${encodeURIComponent(id)}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        console.log(`Skill "${id}" deactivated.`);
      } else {
        console.error(`Failed: ${data.error}`);
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });
