// ============================================================
// Programming Skill Pack - DevOps, Code, Git, CI/CD
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';
import { exec } from 'child_process';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

const manifest: SkillManifest = {
  id: 'programming',
  name: 'Programming & DevOps',
  version: '1.0.0',
  description: 'Code generation, execution, Git, testing, CI/CD monitoring, and development tools',
  author: 'xClaw',
  category: 'programming',
  tags: ['code', 'git', 'devops', 'testing', 'ci-cd'],
  tools: [
    {
      name: 'shell_exec',
      description: 'Execute a shell command on the local machine. Use for running build commands, package managers, scripts, etc.',
      category: 'programming',
      parameters: [
        { name: 'command', type: 'string', description: 'The shell command to execute', required: true },
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
        { name: 'timeout', type: 'number', description: 'Timeout in ms (default 30000)', required: false },
      ],
      returns: { name: 'output', type: 'object', description: '{ stdout, stderr, exitCode }' },
      requiresApproval: true,
      timeout: 60000,
    },
    {
      name: 'file_read',
      description: 'Read the contents of a file',
      category: 'programming',
      parameters: [
        { name: 'path', type: 'string', description: 'Absolute or relative file path', required: true },
        { name: 'encoding', type: 'string', description: 'File encoding (default: utf-8)', required: false },
      ],
      returns: { name: 'content', type: 'string', description: 'File contents' },
    },
    {
      name: 'file_write',
      description: 'Write content to a file (creates parent dirs if needed)',
      category: 'programming',
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'content', type: 'string', description: 'Content to write', required: true },
      ],
      returns: { name: 'result', type: 'object', description: '{ success, path }' },
      requiresApproval: true,
    },
    {
      name: 'file_list',
      description: 'List files and directories in a path',
      category: 'programming',
      parameters: [
        { name: 'path', type: 'string', description: 'Directory path', required: true },
        { name: 'recursive', type: 'boolean', description: 'List recursively', required: false },
      ],
      returns: { name: 'files', type: 'array', description: 'Array of file entries' },
    },
    {
      name: 'git_status',
      description: 'Get git status of a repository',
      category: 'programming',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Path to git repository', required: true },
      ],
      returns: { name: 'status', type: 'string', description: 'Git status output' },
    },
    {
      name: 'git_diff',
      description: 'Get git diff (staged or unstaged changes)',
      category: 'programming',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Path to git repository', required: true },
        { name: 'staged', type: 'boolean', description: 'Show staged changes', required: false },
      ],
      returns: { name: 'diff', type: 'string', description: 'Git diff output' },
    },
    {
      name: 'git_commit',
      description: 'Create a git commit with a message',
      category: 'programming',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Path to git repository', required: true },
        { name: 'message', type: 'string', description: 'Commit message', required: true },
        { name: 'addAll', type: 'boolean', description: 'Stage all changes before committing', required: false },
      ],
      returns: { name: 'result', type: 'string', description: 'Commit result' },
      requiresApproval: true,
    },
    {
      name: 'git_log',
      description: 'View git commit history',
      category: 'programming',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Path to git repository', required: true },
        { name: 'count', type: 'number', description: 'Number of commits to show (default 10)', required: false },
      ],
      returns: { name: 'log', type: 'string', description: 'Git log output' },
    },
    {
      name: 'run_tests',
      description: 'Run test suite for a project. Auto-detects test runner (jest, vitest, pytest, cargo test, go test).',
      category: 'programming',
      parameters: [
        { name: 'projectPath', type: 'string', description: 'Path to the project', required: true },
        { name: 'testFile', type: 'string', description: 'Specific test file to run', required: false },
        { name: 'runner', type: 'string', description: 'Override test runner command', required: false },
      ],
      returns: { name: 'result', type: 'object', description: '{ stdout, stderr, exitCode, passed }' },
      timeout: 120000,
    },
    {
      name: 'code_search',
      description: 'Search for a pattern in code files using grep/ripgrep',
      category: 'programming',
      parameters: [
        { name: 'pattern', type: 'string', description: 'Search pattern (regex supported)', required: true },
        { name: 'path', type: 'string', description: 'Directory to search in', required: true },
        { name: 'fileType', type: 'string', description: 'File extension filter (e.g. ts, py)', required: false },
      ],
      returns: { name: 'matches', type: 'string', description: 'Search results' },
    },
    {
      name: 'project_analyze',
      description: 'Analyze a project: detect language, framework, dependencies, structure',
      category: 'programming',
      parameters: [
        { name: 'projectPath', type: 'string', description: 'Path to the project', required: true },
      ],
      returns: { name: 'analysis', type: 'object', description: 'Project analysis result' },
    },
  ],
  config: [
    { key: 'defaultCwd', label: 'Default Working Directory', type: 'string', description: 'Default directory for shell commands', required: false },
    { key: 'blockedCommands', label: 'Blocked Commands', type: 'string', description: 'Comma-separated list of blocked shell commands', required: false, default: 'rm -rf /,mkfs,dd' },
  ],
};

// ─── Tool implementations ───────────────────────────────────

function runCommand(command: string, cwd?: string, timeout = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = exec(command, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 10,
      env: { ...process.env, FORCE_COLOR: '0' },
    }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.toString().slice(0, 50000),
        stderr: stderr.toString().slice(0, 10000),
        exitCode: error?.code ?? (error ? 1 : 0),
      });
    });
  });
}

function validateCommand(command: string, blockedList: string[]): boolean {
  const lower = command.toLowerCase().trim();
  return !blockedList.some(blocked => lower.includes(blocked.trim().toLowerCase()));
}

async function listFilesRecursive(dirPath: string, basePath = ''): Promise<{ name: string; type: string; size: number }[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const results: { name: string; type: string; size: number }[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = join(dirPath, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push({ name: relPath, type: 'directory', size: 0 });
      const children = await listFilesRecursive(fullPath, relPath);
      results.push(...children);
    } else {
      const stats = await stat(fullPath);
      results.push({ name: relPath, type: 'file', size: stats.size });
    }
  }
  return results;
}

async function detectTestRunner(projectPath: string): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));
    if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) return 'npx vitest run';
    if (pkg.devDependencies?.jest || pkg.dependencies?.jest) return 'npx jest';
    if (pkg.scripts?.test) return 'npm test';
  } catch { /* not a JS project */ }

  try { await stat(join(projectPath, 'pytest.ini')); return 'python -m pytest'; } catch {}
  try { await stat(join(projectPath, 'pyproject.toml')); return 'python -m pytest'; } catch {}
  try { await stat(join(projectPath, 'Cargo.toml')); return 'cargo test'; } catch {}
  try { await stat(join(projectPath, 'go.mod')); return 'go test ./...'; } catch {}

  return 'npm test';
}

export const programmingSkill = defineSkill(manifest, {
  async shell_exec(args) {
    const blocked = (manifest.config?.[0]?.default as string ?? 'rm -rf /,mkfs,dd').split(',');
    const command = args.command as string;
    if (!validateCommand(command, blocked)) {
      throw new Error(`Command blocked for safety: ${command}`);
    }
    return runCommand(command, args.cwd as string, args.timeout as number);
  },

  async file_read(args) {
    const content = await readFile(args.path as string, (args.encoding as BufferEncoding) ?? 'utf-8');
    return { content, path: args.path, size: content.length };
  },

  async file_write(args) {
    const { mkdir } = await import('fs/promises');
    const { dirname } = await import('path');
    await mkdir(dirname(args.path as string), { recursive: true });
    await writeFile(args.path as string, args.content as string, 'utf-8');
    return { success: true, path: args.path };
  },

  async file_list(args) {
    if (args.recursive) {
      return listFilesRecursive(args.path as string);
    }
    const entries = await readdir(args.path as string, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' }));
  },

  async git_status(args) {
    return runCommand('git status --short', args.repoPath as string);
  },

  async git_diff(args) {
    const staged = args.staged ? ' --staged' : '';
    return runCommand(`git diff${staged}`, args.repoPath as string);
  },

  async git_commit(args) {
    const cwd = args.repoPath as string;
    if (args.addAll) await runCommand('git add -A', cwd);
    return runCommand(`git commit -m "${(args.message as string).replace(/"/g, '\\"')}"`, cwd);
  },

  async git_log(args) {
    const count = (args.count as number) ?? 10;
    return runCommand(`git log --oneline -n ${count}`, args.repoPath as string);
  },

  async run_tests(args) {
    const projectPath = args.projectPath as string;
    let runner = args.runner as string;
    if (!runner) runner = await detectTestRunner(projectPath);
    if (args.testFile) runner += ` ${args.testFile}`;
    const result = await runCommand(runner, projectPath, 120000);
    return { ...result, passed: result.exitCode === 0 };
  },

  async code_search(args) {
    const pattern = args.pattern as string;
    const path = args.path as string;
    const ext = args.fileType ? `--include="*.${args.fileType}"` : '';
    return runCommand(`grep -rn ${ext} "${pattern}" "${path}" | head -50`);
  },

  async project_analyze(args) {
    const projectPath = args.projectPath as string;
    const files = await listFilesRecursive(projectPath);
    const extensions = new Map<string, number>();

    for (const f of files) {
      if (f.type === 'file') {
        const ext = f.name.split('.').pop() ?? '';
        extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
      }
    }

    let language = 'unknown';
    let framework = 'unknown';

    try {
      const pkg = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));
      language = pkg.devDependencies?.typescript ? 'TypeScript' : 'JavaScript';
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react) framework = 'React';
      else if (deps.vue) framework = 'Vue';
      else if (deps.next) framework = 'Next.js';
      else if (deps.express) framework = 'Express';
      else if (deps.fastify) framework = 'Fastify';
    } catch {}

    if (extensions.has('py')) language = 'Python';
    if (extensions.has('rs')) language = 'Rust';
    if (extensions.has('go')) language = 'Go';
    if (extensions.has('java')) language = 'Java';

    return {
      language,
      framework,
      totalFiles: files.length,
      fileTypes: Object.fromEntries(extensions),
      structure: files.slice(0, 50),
    };
  },
});
