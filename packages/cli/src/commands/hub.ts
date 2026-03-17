// ============================================================
// CLI: xclaw hub - SkillHub marketplace commands
// ============================================================

import { Command } from 'commander';

const DEFAULT_URL = 'http://127.0.0.1:18789';

export const hubCommand = new Command('hub')
  .description('SkillHub — Browse, install, import, and publish skills');

// ─── Discovery ─────────────────────────────────────────────

hubCommand
  .command('search [query]')
  .description('Search for skills in SkillHub')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .option('--category <cat>', 'Filter by category')
  .option('--source <source>', 'Filter by source (built-in, anthropic, community, npm, mcp)')
  .option('--limit <n>', 'Results per page', '20')
  .option('--page <n>', 'Page number', '1')
  .action(async (query: string | undefined, opts) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      if (opts.category) params.set('category', opts.category);
      if (opts.source) params.set('source', opts.source);
      params.set('limit', opts.limit);
      params.set('page', opts.page);

      const res = await fetch(`${opts.url}/api/hub/skills?${params}`);
      const data = await res.json() as {
        skills: Array<{ id: string; name: string; version: string; source: string; description: string; stats: { rating: number; installs: number } }>;
        total: number;
        page: number;
        hasMore: boolean;
      };

      if (data.skills.length === 0) {
        console.log('\n  No skills found.\n');
        return;
      }

      console.log(`\n  SkillHub — ${data.total} skills found (page ${data.page})\n`);
      for (const skill of data.skills) {
        const stars = skill.stats.rating > 0 ? `★${skill.stats.rating.toFixed(1)}` : '    ';
        const installs = skill.stats.installs > 0 ? `${skill.stats.installs}↓` : '';
        console.log(`  📦 ${skill.id.padEnd(35)} v${skill.version.padEnd(8)} ${stars.padEnd(6)} ${installs}`);
        console.log(`     ${skill.description}`);
        console.log(`     [${skill.source}]\n`);
      }

      if (data.hasMore) {
        console.log(`  → More results: xclaw hub search ${query ?? ''} --page ${data.page + 1}\n`);
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

hubCommand
  .command('list')
  .description('List all available skills in SkillHub')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .option('--source <source>', 'Filter by source')
  .action(async (opts) => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (opts.source) params.set('source', opts.source);

      const res = await fetch(`${opts.url}/api/hub/skills?${params}`);
      const data = await res.json() as {
        skills: Array<{ id: string; name: string; version: string; source: string; category: string; stats: { installs: number } }>;
        total: number;
      };

      console.log(`\n  SkillHub Registry — ${data.total} skills\n`);

      // Group by source
      const bySource = new Map<string, typeof data.skills>();
      for (const skill of data.skills) {
        const group = bySource.get(skill.source) ?? [];
        group.push(skill);
        bySource.set(skill.source, group);
      }

      for (const [source, skills] of bySource) {
        console.log(`  ── ${source.toUpperCase()} (${skills.length}) ──`);
        for (const s of skills) {
          console.log(`    ${s.id.padEnd(35)} v${s.version.padEnd(8)} [${s.category}]`);
        }
        console.log('');
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

hubCommand
  .command('info <skillId>')
  .description('Show detailed info about a skill')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .action(async (skillId: string, opts) => {
    try {
      const res = await fetch(`${opts.url}/api/hub/skills/${encodeURIComponent(skillId)}`);
      if (!res.ok) {
        console.error(`Skill not found: ${skillId}`);
        process.exit(1);
      }
      const skill = await res.json() as {
        id: string; name: string; version: string; description: string; longDescription?: string;
        author: { name: string; verified: boolean }; category: string; tags: string[];
        source: string; stats: { installs: number; rating: number; reviewCount: number };
        manifest: { tools: Array<{ name: string; description: string }> };
      };

      console.log(`\n  📦 ${skill.name} (${skill.id})`);
      console.log(`  ${'─'.repeat(50)}`);
      console.log(`  Version:     ${skill.version}`);
      console.log(`  Author:      ${skill.author.name}${skill.author.verified ? ' ✓' : ''}`);
      console.log(`  Category:    ${skill.category}`);
      console.log(`  Source:      ${skill.source}`);
      console.log(`  Tags:        ${skill.tags.join(', ')}`);
      console.log(`  Rating:      ${skill.stats.rating > 0 ? `★${skill.stats.rating.toFixed(1)} (${skill.stats.reviewCount} reviews)` : 'No ratings yet'}`);
      console.log(`  Installs:    ${skill.stats.installs}`);
      console.log(`\n  Description:`);
      console.log(`  ${skill.description}`);

      if (skill.manifest.tools.length > 0) {
        console.log(`\n  Tools (${skill.manifest.tools.length}):`);
        for (const tool of skill.manifest.tools) {
          console.log(`    • ${tool.name} — ${tool.description}`);
        }
      }
      console.log('');
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

// ─── Installation ──────────────────────────────────────────

hubCommand
  .command('install <skillId>')
  .description('Install a skill from SkillHub')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .option('--npm <package>', 'Install from npm package')
  .option('--git <repo>', 'Install from git repository')
  .option('--file <path>', 'Install from local file')
  .action(async (skillId: string, opts) => {
    try {
      let endpoint = `${opts.url}/api/hub/skills/${encodeURIComponent(skillId)}/install`;
      let body: Record<string, string> = {};

      if (opts.npm) {
        endpoint = `${opts.url}/api/hub/install`;
        body = { type: 'npm', package: opts.npm };
      } else if (opts.git) {
        endpoint = `${opts.url}/api/hub/install`;
        body = { type: 'git', url: opts.git };
      } else if (opts.file) {
        endpoint = `${opts.url}/api/hub/install`;
        body = { type: 'file', path: opts.file };
      }

      console.log(`\n  Installing ${skillId}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; message: string };

      if (data.success) {
        console.log(`  ✓ ${data.message}\n`);
      } else {
        console.error(`  ✗ ${data.message}\n`);
        process.exit(1);
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

hubCommand
  .command('uninstall <skillId>')
  .description('Uninstall a skill')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .action(async (skillId: string, opts) => {
    try {
      const res = await fetch(`${opts.url}/api/hub/skills/${encodeURIComponent(skillId)}/uninstall`, {
        method: 'DELETE',
      });
      const data = await res.json() as { success: boolean; message: string };
      console.log(data.success ? `  ✓ ${data.message}` : `  ✗ ${data.message}`);
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

// ─── Anthropic Import ──────────────────────────────────────

const importCmd = hubCommand
  .command('import')
  .description('Import skills from external sources');

importCmd
  .command('anthropic [skillName]')
  .description('Import skills from Anthropic\'s repository (github.com/anthropics/skills)')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .option('--all', 'Import all available skills')
  .action(async (skillName: string | undefined, opts) => {
    try {
      if (opts.all) {
        console.log('\n  Importing all Anthropic skills...\n');
        const res = await fetch(`${opts.url}/api/hub/import/anthropic/sync`, {
          method: 'POST',
        });
        const data = await res.json() as { imported: number; failed: number };
        console.log(`  ✓ Imported: ${data.imported}, Failed: ${data.failed}\n`);
      } else if (skillName) {
        console.log(`\n  Importing Anthropic skill: ${skillName}...\n`);
        const res = await fetch(`${opts.url}/api/hub/import/anthropic/${encodeURIComponent(skillName)}`, {
          method: 'POST',
        });
        const data = await res.json() as { success: boolean; message: string; entry?: { id: string; name: string } };
        if (data.success) {
          console.log(`  ✓ ${data.message}\n`);
        } else {
          console.error(`  ✗ ${data.message}\n`);
        }
      } else {
        // List available
        console.log('\n  Fetching available Anthropic skills...\n');
        const res = await fetch(`${opts.url}/api/hub/import/anthropic`);
        const data = await res.json() as { skills: Array<{ name: string; description: string; folderPath: string }> };

        if (data.skills.length === 0) {
          console.log('  No skills found.\n');
          return;
        }

        console.log(`  Available Anthropic Skills (${data.skills.length}):\n`);
        for (const skill of data.skills) {
          console.log(`    ${skill.name.padEnd(30)} ${skill.description.slice(0, 60)}`);
        }
        console.log(`\n  Import one:  xclaw hub import anthropic <name>`);
        console.log(`  Import all:  xclaw hub import anthropic --all\n`);
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

importCmd
  .command('mcp <package>')
  .description('Import an MCP server as an xClaw skill')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .action(async (packageName: string, opts) => {
    try {
      console.log(`\n  Importing MCP server: ${packageName}...\n`);
      const res = await fetch(`${opts.url}/api/hub/import/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: packageName }),
      });
      const data = await res.json() as { success: boolean; message: string };
      console.log(data.success ? `  ✓ ${data.message}\n` : `  ✗ ${data.message}\n`);
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

// ─── Skill Creation ────────────────────────────────────────

hubCommand
  .command('create <name>')
  .description('Scaffold a new skill project')
  .option('--dir <dir>', 'Output directory', '.')
  .option('--category <cat>', 'Skill category', 'custom')
  .option('--author <author>', 'Author name', 'xClaw Community')
  .option('--no-tests', 'Skip test files')
  .option('--no-skill-md', 'Skip Anthropic SKILL.md')
  .action(async (name: string, opts) => {
    // Validate name is kebab-case
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      console.error('Skill name must be kebab-case (e.g., my-awesome-skill)');
      process.exit(1);
    }

    try {
      const { SkillScaffold } = await import('@xclaw/skill-hub');
      const scaffold = new SkillScaffold();

      const displayName = name
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const outputPath = await scaffold.generate({
        name,
        displayName,
        description: `${displayName} skill for xClaw`,
        category: opts.category,
        tags: [name, opts.category],
        author: opts.author,
        includeTests: opts.tests !== false,
        includeSkillMd: opts.skillMd !== false,
        outputDir: opts.dir,
      });

      console.log(`\n  ✓ Skill scaffolded: ${outputPath}\n`);
      console.log('  Next steps:');
      console.log(`    cd ${outputPath}`);
      console.log('    npm install');
      console.log('    # Edit src/tools/ to add your tools');
      console.log('    npm run build');
      console.log('    xclaw hub validate');
      console.log('    xclaw hub publish\n');
    } catch (err) {
      console.error(`Failed to scaffold: ${(err as Error).message}`);
      process.exit(1);
    }
  });

hubCommand
  .command('publish')
  .description('Publish current skill to SkillHub')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .option('--npm', 'Also publish to npm')
  .action(async (opts) => {
    try {
      // Read local xclaw.plugin.json
      const { readFile } = await import('node:fs/promises');
      const manifestRaw = await readFile('xclaw.plugin.json', 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      let readme: string | undefined;
      try {
        readme = await readFile('README.md', 'utf-8');
      } catch { /* optional */ }

      console.log(`\n  Publishing ${manifest.name} v${manifest.version}...\n`);

      const res = await fetch(`${opts.url}/api/hub/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest, readme, author: { name: manifest.author ?? 'Anonymous' } }),
      });
      const data = await res.json() as { success: boolean; message: string; submissionId?: string };

      if (data.success) {
        console.log(`  ✓ ${data.message}`);
        if (data.submissionId) {
          console.log(`  Submission ID: ${data.submissionId}`);
        }
        console.log('');
      } else {
        console.error(`  ✗ ${data.message}\n`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`Publish failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ─── Updates ───────────────────────────────────────────────

hubCommand
  .command('update [skillId]')
  .description('Check and apply updates')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .option('--check', 'Only check, do not apply')
  .action(async (skillId: string | undefined, opts) => {
    try {
      console.log('\n  Checking for updates...\n');
      const res = await fetch(`${opts.url}/api/hub/updates`);
      const data = await res.json() as { updates: Array<{ skillId: string; hasUpdate: boolean; currentVersion: string }> };

      const updates = data.updates.filter(u => u.hasUpdate);
      if (updates.length === 0) {
        console.log('  ✓ All skills are up to date.\n');
        return;
      }

      console.log(`  ${updates.length} update(s) available:\n`);
      for (const u of updates) {
        console.log(`    ${u.skillId} (current: v${u.currentVersion})`);
      }
      console.log('');

      if (!opts.check && skillId) {
        const updateRes = await fetch(`${opts.url}/api/hub/skills/${encodeURIComponent(skillId)}/update`, {
          method: 'POST',
        });
        const updateData = await updateRes.json() as { success: boolean; message: string };
        console.log(updateData.success ? `  ✓ ${updateData.message}\n` : `  ✗ ${updateData.message}\n`);
      }
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });

// ─── Stats ─────────────────────────────────────────────────

hubCommand
  .command('stats')
  .description('Show SkillHub statistics')
  .option('--url <url>', 'Gateway REST URL', DEFAULT_URL)
  .action(async (opts) => {
    try {
      const res = await fetch(`${opts.url}/api/hub/stats`);
      const data = await res.json() as {
        total: number;
        bySource: Record<string, number>;
        byCategory: Record<string, number>;
      };

      console.log(`\n  SkillHub Statistics`);
      console.log(`  ${'─'.repeat(40)}`);
      console.log(`  Total Skills: ${data.total}\n`);

      console.log('  By Source:');
      for (const [source, count] of Object.entries(data.bySource)) {
        console.log(`    ${source.padEnd(15)} ${count}`);
      }

      console.log('\n  By Category:');
      for (const [cat, count] of Object.entries(data.byCategory)) {
        console.log(`    ${cat.padEnd(20)} ${count}`);
      }
      console.log('');
    } catch {
      console.error('Cannot connect to Gateway. Is it running?');
      process.exit(1);
    }
  });
