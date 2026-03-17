// ============================================================
// Skill Scaffold — Generate new skill project from template
// ============================================================

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SkillCategory } from '@xclaw/shared';

export interface ScaffoldOptions {
  name: string;           // kebab-case: my-awesome-skill
  displayName: string;    // My Awesome Skill
  description: string;
  category: SkillCategory;
  tags: string[];
  author: string;
  authorEmail?: string;
  includeTests: boolean;
  includeSkillMd: boolean;
  outputDir: string;
}

export class SkillScaffold {

  /**
   * Generate a complete skill project structure
   */
  async generate(options: ScaffoldOptions): Promise<string> {
    const baseDir = join(options.outputDir, options.name);

    // Create directory structure
    await mkdir(join(baseDir, 'src', 'tools'), { recursive: true });
    if (options.includeTests) {
      await mkdir(join(baseDir, 'tests'), { recursive: true });
    }

    // Generate all files in parallel
    const files = [
      this.writePackageJson(baseDir, options),
      this.writeTsConfig(baseDir),
      this.writePluginManifest(baseDir, options),
      this.writeIndexTs(baseDir, options),
      this.writeExampleTool(baseDir, options),
      this.writeReadme(baseDir, options),
    ];

    if (options.includeSkillMd) {
      files.push(this.writeSkillMd(baseDir, options));
    }

    if (options.includeTests) {
      files.push(this.writeExampleTest(baseDir, options));
    }

    await Promise.all(files);

    return baseDir;
  }

  // ─── File Generators ─────────────────────────────────────

  private async writePackageJson(baseDir: string, opts: ScaffoldOptions): Promise<void> {
    const pkg = {
      name: `@xclaw/skill-${opts.name}`,
      version: '1.0.0',
      type: 'module',
      description: opts.description,
      license: 'MIT',
      author: opts.authorEmail ? `${opts.author} <${opts.authorEmail}>` : opts.author,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          import: './dist/index.js',
          types: './dist/index.d.ts',
        },
      },
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
        test: 'vitest',
      },
      dependencies: {
        '@xclaw/shared': '^0.1.0',
        '@xclaw/core': '^0.1.0',
      },
      devDependencies: {
        typescript: '^5.7.0',
        vitest: '^3.0.0',
      },
      keywords: ['xclaw', 'skill', opts.category, ...opts.tags],
    };

    await writeFile(join(baseDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8');
  }

  private async writeTsConfig(baseDir: string): Promise<void> {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ['src'],
    };

    await writeFile(join(baseDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8');
  }

  private async writePluginManifest(baseDir: string, opts: ScaffoldOptions): Promise<void> {
    const manifest = {
      name: `@xclaw/skill-${opts.name}`,
      version: '1.0.0',
      description: opts.description,
      author: opts.author,
      type: 'skill',
      category: opts.category,
      entry: 'dist/index.js',
      config: [],
    };

    await writeFile(join(baseDir, 'xclaw.plugin.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  }

  private async writeIndexTs(baseDir: string, opts: ScaffoldOptions): Promise<void> {
    const id = opts.name.replace(/-/g, '_');
    const content = `// ============================================================
// ${opts.displayName} — xClaw Skill
// ${opts.description}
// ============================================================

import { defineSkill } from '@xclaw/core';
import { exampleTool, executeExample } from './tools/example-tool.js';

export const ${id}Skill = defineSkill(
  {
    id: '${opts.name}',
    name: '${opts.displayName}',
    version: '1.0.0',
    description: '${opts.description}',
    author: '${opts.author}',
    category: '${opts.category}',
    tags: ${JSON.stringify(opts.tags)},
    tools: [exampleTool],
  },
  {
    'example_tool': executeExample,
  }
);

export default ${id}Skill;
`;

    await writeFile(join(baseDir, 'src', 'index.ts'), content, 'utf-8');
  }

  private async writeExampleTool(baseDir: string, opts: ScaffoldOptions): Promise<void> {
    const content = `// ============================================================
// Example Tool — Replace with your actual tool implementation
// ============================================================

import type { ToolDefinition } from '@xclaw/shared';

export const exampleTool: ToolDefinition = {
  name: 'example_tool',
  description: 'An example tool for ${opts.displayName}. Replace this with your actual tool.',
  category: '${opts.category}',
  parameters: [
    {
      name: 'input',
      type: 'string',
      description: 'The input to process',
      required: true,
    },
  ],
  returns: {
    name: 'result',
    type: 'string',
    description: 'The processed result',
  },
};

export async function executeExample(
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const input = args.input as string;

  // TODO: Replace with your actual implementation
  return {
    result: \`Processed: \${input}\`,
    timestamp: new Date().toISOString(),
  };
}
`;

    await writeFile(join(baseDir, 'src', 'tools', 'example-tool.ts'), content, 'utf-8');
  }

  private async writeSkillMd(baseDir: string, opts: ScaffoldOptions): Promise<void> {
    const content = `---
name: ${opts.name}
description: ${opts.description}
---

# ${opts.displayName}

## Instructions

${opts.description}

### When to Use
- Use this skill when the user asks about ${opts.category}-related tasks
- Activate when specific keywords related to your domain are detected

### How to Use
1. Analyze the user's request
2. Determine the appropriate tool to call
3. Execute the tool with the correct parameters
4. Format and return the result

## Examples

### Example 1
**User:** "Help me with a ${opts.category} task"
**Action:** Call \`example_tool\` with the user's input
**Result:** Return the processed output

## Notes
- This skill follows xClaw's skill plugin pattern
- Compatible with Anthropic's SKILL.md format
- Can be imported into any agent that supports the xClaw skill system
`;

    await writeFile(join(baseDir, 'SKILL.md'), content, 'utf-8');
  }

  private async writeReadme(baseDir: string, opts: ScaffoldOptions): Promise<void> {
    const content = `# ${opts.displayName}

${opts.description}

## Installation

\`\`\`bash
xclaw hub install ${opts.name}
# or
npm install @xclaw/skill-${opts.name}
\`\`\`

## Usage

\`\`\`typescript
import { ${opts.name.replace(/-/g, '_')}Skill } from '@xclaw/skill-${opts.name}';

// Register with xClaw agent
agent.skills.register(${opts.name.replace(/-/g, '_')}Skill);
await agent.skills.activate('${opts.name}');
\`\`\`

## Tools

| Tool | Description |
|------|-------------|
| \`example_tool\` | An example tool — replace with your actual tools |

## Development

\`\`\`bash
npm run dev     # Watch mode
npm run build   # Build
npm run test    # Run tests
\`\`\`

## Publishing

\`\`\`bash
xclaw hub validate    # Validate skill
xclaw hub publish     # Publish to SkillHub
\`\`\`

## License

MIT
`;

    await writeFile(join(baseDir, 'README.md'), content, 'utf-8');
  }

  private async writeExampleTest(baseDir: string, opts: ScaffoldOptions): Promise<void> {
    const content = `import { describe, it, expect } from 'vitest';
import { executeExample } from '../src/tools/example-tool.js';

describe('example_tool', () => {
  it('should process input correctly', async () => {
    const result = await executeExample({ input: 'hello world' });
    expect(result.result).toBe('Processed: hello world');
    expect(result.timestamp).toBeDefined();
  });

  it('should handle empty input', async () => {
    const result = await executeExample({ input: '' });
    expect(result.result).toBe('Processed: ');
  });
});
`;

    await writeFile(join(baseDir, 'tests', 'example-tool.test.ts'), content, 'utf-8');
  }
}
