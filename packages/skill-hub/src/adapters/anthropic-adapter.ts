// ============================================================
// Anthropic Skill Adapter — Import skills from anthropics/skills
// Converts SKILL.md format → xClaw SkillManifest
// ============================================================

import type {
  AnthropicSkill,
  HubSkillEntry,
  SkillManifest,
  ToolDefinition,
  SkillCategory,
} from '@xclaw/shared';

const ANTHROPIC_SKILLS_REPO = 'anthropics/skills';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

interface GitHubContentResponse {
  content: string;
  encoding: string;
  sha: string;
}

export class AnthropicAdapter {
  private githubToken?: string;

  constructor(githubToken?: string) {
    this.githubToken = githubToken;
  }

  // ─── Public API ──────────────────────────────────────────

  /**
   * List all available skills from anthropics/skills repository
   */
  async listAvailableSkills(): Promise<AnthropicSkill[]> {
    const tree = await this.fetchRepoTree();
    const skillFolders = this.findSkillFolders(tree);
    const skills: AnthropicSkill[] = [];

    for (const folder of skillFolders) {
      try {
        const skill = await this.fetchAndParseSkill(folder);
        if (skill) skills.push(skill);
      } catch (err) {
        console.warn(`[anthropic-adapter] Failed to parse skill: ${folder}`, err);
      }
    }

    return skills;
  }

  /**
   * Import a specific skill by name (folder name)
   */
  async importSkill(skillName: string): Promise<HubSkillEntry | null> {
    const skillMd = await this.fetchSkillMd(skillName);
    if (!skillMd) return null;

    const parsed = this.parseSkillMd(skillMd, skillName);
    return this.convertToHubEntry(parsed);
  }

  /**
   * Import all available skills
   */
  async importAll(): Promise<HubSkillEntry[]> {
    const skills = await this.listAvailableSkills();
    return skills.map(s => this.convertToHubEntry(s));
  }

  /**
   * Check for updates (compare local SHA with remote)
   */
  async checkForUpdates(localSkills: HubSkillEntry[]): Promise<{ skillId: string; hasUpdate: boolean }[]> {
    const tree = await this.fetchRepoTree();
    const results: { skillId: string; hasUpdate: boolean }[] = [];

    for (const skill of localSkills) {
      if (skill.source !== 'anthropic') continue;
      const folderPath = skill.skillMd ? this.extractFolderFromId(skill.id) : null;
      if (!folderPath) continue;

      const entry = tree.tree.find(e => e.path === `${folderPath}/SKILL.md`);
      const hasUpdate = entry ? entry.sha !== skill.distribution.checksum : false;
      results.push({ skillId: skill.id, hasUpdate });
    }

    return results;
  }

  // ─── SKILL.md Parser ─────────────────────────────────────

  /**
   * Parse Anthropic's SKILL.md format:
   * ---
   * name: skill-name-in-kebab-case
   * description: What it does and when to use it
   * allowed-tools: [tool1, tool2]
   * ---
   * # Instructions
   * ...
   */
  parseSkillMd(content: string, folderName: string): AnthropicSkill {
    const frontmatter = this.extractFrontmatter(content);
    const body = this.extractBody(content);

    const name = frontmatter.name ?? folderName;
    const description = frontmatter.description ?? `Imported from Anthropic: ${folderName}`;

    let allowedTools: string[] | undefined;
    if (frontmatter['allowed-tools']) {
      const raw = frontmatter['allowed-tools'];
      if (typeof raw === 'string') {
        // Parse YAML array format: [tool1, tool2]
        allowedTools = raw
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
      } else if (Array.isArray(raw)) {
        allowedTools = raw;
      }
    }

    // Extract examples section if present
    const examplesMatch = body.match(/##?\s*Examples?\s*\n([\s\S]*?)(?=##?\s|\n$)/i);
    const examples = examplesMatch ? examplesMatch[1].trim() : undefined;

    return {
      name,
      description,
      allowedTools,
      instructions: body,
      examples,
      sourceRepoUrl: `https://github.com/${ANTHROPIC_SKILLS_REPO}`,
      folderPath: folderName,
    };
  }

  // ─── Conversion ──────────────────────────────────────────

  /**
   * Convert AnthropicSkill → xClaw HubSkillEntry
   * Anthropic skills are "Prompt-Based Skills" — they inject instructions
   * into the system prompt rather than providing executable tools.
   */
  convertToHubEntry(skill: AnthropicSkill): HubSkillEntry {
    const id = `anthropic/${skill.name}`;
    const manifest = this.buildManifest(skill);
    const now = new Date().toISOString();

    return {
      id,
      name: this.humanize(skill.name),
      slug: skill.name,
      version: '1.0.0',
      description: skill.description,
      longDescription: skill.instructions,
      author: {
        name: 'Anthropic',
        url: 'https://anthropic.com',
        verified: true,
      },
      license: 'MIT',
      category: this.inferCategory(skill),
      tags: this.inferTags(skill),
      source: 'anthropic',
      manifest,
      skillMd: this.reconstructSkillMd(skill),
      stats: {
        installs: 0,
        activeInstalls: 0,
        rating: 0,
        reviewCount: 0,
        weeklyDownloads: 0,
      },
      distribution: {
        type: 'git',
        url: `https://github.com/${ANTHROPIC_SKILLS_REPO}/tree/main/${skill.folderPath}`,
        checksum: skill.sourceCommitSha,
      },
      compatible: true,
      featured: false,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    };
  }

  /**
   * Build xClaw SkillManifest from Anthropic skill.
   * Creates a "prompt-injection" tool that injects SKILL.md instructions
   * into the agent's context when activated.
   */
  private buildManifest(skill: AnthropicSkill): SkillManifest {
    const tools: ToolDefinition[] = [];

    // Main tool: inject skill instructions into context
    tools.push({
      name: `anthropic_${skill.name.replace(/-/g, '_')}`,
      description: `${skill.description}. Activating this tool loads specialized instructions from Anthropic's ${skill.name} skill.`,
      category: 'anthropic-skill',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The user request to apply this skill to',
          required: true,
        },
      ],
      returns: {
        name: 'result',
        type: 'string',
        description: 'Skill-guided response',
      },
    });

    // If skill references MCP tools, create bridge tool definitions
    if (skill.allowedTools?.length) {
      for (const toolName of skill.allowedTools) {
        tools.push({
          name: `bridge_${toolName.replace(/[^a-z0-9_]/gi, '_')}`,
          description: `Bridge to MCP tool: ${toolName} (referenced by Anthropic ${skill.name} skill)`,
          category: 'mcp-bridge',
          parameters: [
            {
              name: 'args',
              type: 'object',
              description: `Arguments for ${toolName}`,
              required: false,
            },
          ],
          returns: {
            name: 'result',
            type: 'object',
            description: 'Tool execution result',
          },
        });
      }
    }

    return {
      id: `anthropic-${skill.name}`,
      name: this.humanize(skill.name),
      version: '1.0.0',
      description: skill.description,
      author: 'Anthropic',
      category: this.inferCategory(skill),
      tags: this.inferTags(skill),
      tools,
      config: [
        {
          key: 'injectMode',
          label: 'Injection Mode',
          type: 'select',
          description: 'How to inject skill instructions',
          default: 'system-prompt',
          options: [
            { label: 'System Prompt (recommended)', value: 'system-prompt' },
            { label: 'Tool Response', value: 'tool-response' },
          ],
        },
      ],
    };
  }

  // ─── GitHub API ──────────────────────────────────────────

  private async fetchRepoTree(): Promise<GitHubTreeResponse> {
    const url = `${GITHUB_API_BASE}/repos/${ANTHROPIC_SKILLS_REPO}/git/trees/main?recursive=1`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<GitHubTreeResponse>;
  }

  private findSkillFolders(tree: GitHubTreeResponse): string[] {
    // Find directories that contain a SKILL.md file
    const skillFiles = tree.tree
      .filter(e => e.type === 'blob' && e.path.endsWith('/SKILL.md'))
      .map(e => e.path.replace('/SKILL.md', ''));

    return skillFiles;
  }

  private async fetchSkillMd(skillName: string): Promise<string | null> {
    // Try direct path first
    const url = `${GITHUB_RAW_BASE}/${ANTHROPIC_SKILLS_REPO}/main/${skillName}/SKILL.md`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) return null;
    return res.text();
  }

  private async fetchAndParseSkill(folderPath: string): Promise<AnthropicSkill | null> {
    const content = await this.fetchSkillMd(folderPath);
    if (!content) return null;

    const dirName = folderPath.split('/').pop() ?? folderPath;
    const skill = this.parseSkillMd(content, dirName);
    skill.folderPath = folderPath;
    return skill;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'xClaw-SkillHub/1.0',
    };
    if (this.githubToken) {
      headers['Authorization'] = `Bearer ${this.githubToken}`;
    }
    return headers;
  }

  // ─── Helpers ─────────────────────────────────────────────

  private extractFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return {};

    const yaml = match[1];
    const result: Record<string, unknown> = {};

    for (const line of yaml.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      let value: unknown = line.slice(colonIdx + 1).trim();

      // Handle YAML arrays: [item1, item2]
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      }

      if (key) result[key] = value;
    }

    return result;
  }

  private extractBody(content: string): string {
    const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
  }

  private humanize(kebabCase: string): string {
    return kebabCase
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private inferCategory(skill: AnthropicSkill): SkillCategory {
    const text = `${skill.name} ${skill.description} ${skill.instructions}`.toLowerCase();

    const categoryMap: [string[], SkillCategory][] = [
      [['deploy', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes', 'infrastructure'], 'devops'],
      [['code', 'program', 'debug', 'refactor', 'test', 'typescript', 'python', 'javascript'], 'programming'],
      [['design', 'ui', 'ux', 'figma', 'css', 'layout', 'wireframe'], 'design'],
      [['write', 'blog', 'article', 'copy', 'content', 'document', 'pdf'], 'content'],
      [['research', 'analyze', 'study', 'investigate', 'survey'], 'research'],
      [['data', 'analytics', 'chart', 'visualization', 'metric', 'dashboard'], 'analytics'],
      [['health', 'medical', 'clinical', 'patient', 'drug', 'symptom'], 'healthcare'],
      [['finance', 'accounting', 'budget', 'invoice', 'tax', 'payment'], 'finance'],
      [['sales', 'crm', 'lead', 'customer', 'pipeline', 'deal'], 'sales'],
      [['project', 'task', 'sprint', 'agile', 'kanban', 'roadmap'], 'project-management'],
      [['learn', 'teach', 'course', 'tutorial', 'quiz', 'education'], 'learning'],
      [['market', 'seo', 'campaign', 'email', 'social', 'ads'], 'marketing'],
      [['shop', 'product', 'inventory', 'order', 'cart', 'payment'], 'ecommerce'],
      [['home', 'iot', 'smart', 'sensor', 'automation', 'device'], 'smart-home'],
      [['chat', 'email', 'message', 'notification', 'slack'], 'communication'],
    ];

    for (const [keywords, category] of categoryMap) {
      if (keywords.some(kw => text.includes(kw))) return category;
    }
    return 'productivity';
  }

  private inferTags(skill: AnthropicSkill): string[] {
    const tags = new Set<string>(['anthropic', skill.name]);

    if (skill.allowedTools?.length) {
      tags.add('mcp');
      for (const tool of skill.allowedTools.slice(0, 5)) {
        tags.add(tool.replace(/_/g, '-'));
      }
    }

    return [...tags].slice(0, 8);
  }

  private reconstructSkillMd(skill: AnthropicSkill): string {
    let md = '---\n';
    md += `name: ${skill.name}\n`;
    md += `description: ${skill.description}\n`;
    if (skill.allowedTools?.length) {
      md += `allowed-tools: [${skill.allowedTools.join(', ')}]\n`;
    }
    md += '---\n\n';
    md += skill.instructions;
    return md;
  }

  private extractFolderFromId(id: string): string | null {
    // id format: "anthropic/skill-name"
    const parts = id.split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }
}
