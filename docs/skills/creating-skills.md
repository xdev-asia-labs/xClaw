# Skill Development Guide

This guide explains how to create custom skill packs for the xClaw platform. Skills are the primary extension mechanism, adding domain-specific tools that the AI agent can use.

## Concepts

| Term | Definition |
|---|---|
| **Skill** | A plugin package containing related tools for a specific domain |
| **Tool** | A single executable function the AI agent can call |
| **SkillManifest** | Metadata describing a skill (id, name, version, tools) |
| **SkillCategory** | Domain classification: `programming`, `healthcare`, `finance`, `marketing`, etc. |

## Quick Start

### 1. Create the Skill File

Create a new file in `packages/skills/src/your-domain/index.ts`:

```typescript
import { defineSkill } from '@xclaw/core';

export const mySkill = defineSkill({
  id: 'my-domain',
  name: 'My Domain Tools',
  version: '1.0.0',
  description: 'Tools for doing X, Y, and Z',
  author: 'Your Name',
  category: 'custom',
  tags: ['my-domain', 'automation'],

  tools: [
    {
      name: 'my_tool',
      description: 'A clear description of what this tool does (shown to the LLM)',
      category: 'my-domain',
      parameters: [
        {
          name: 'input',
          type: 'string',
          description: 'The input to process',
          required: true,
        },
        {
          name: 'format',
          type: 'string',
          description: 'Output format',
          required: false,
          default: 'text',
          enum: ['text', 'json', 'markdown'],
        },
      ],
      returns: {
        name: 'result',
        type: 'object',
        description: 'The processed result',
      },
      execute: async (args) => {
        const input = args.input as string;
        const format = (args.format as string) ?? 'text';

        // Your logic here
        const result = processInput(input, format);

        return { output: result, format };
      },
    },
  ],
});
```

### 2. Export from Skills Package

Add your skill to `packages/skills/src/index.ts`:

```typescript
export { programmingSkill } from './programming/index.js';
export { healthcareSkill } from './healthcare/index.js';
export { mySkill } from './my-domain/index.js';  // Add this
```

### 3. Register in Server

In `packages/server/src/index.ts`, import and register:

```typescript
import { programmingSkill, healthcareSkill, mySkill } from '@xclaw/skills';

async function initSkills() {
  await agent.skills.register(programmingSkill);
  await agent.skills.register(healthcareSkill);
  await agent.skills.register(mySkill);       // Add this
  await agent.skills.activate('my-domain');    // Activate it
}
```

## Tool Definition Reference

### Parameters

Each tool parameter uses this schema:

```typescript
interface ToolParameter {
  name: string;          // Parameter name (used in function arguments)
  type: string;          // 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string;   // Description shown to the LLM (be specific!)
  required?: boolean;    // Whether the parameter is required (default: false)
  default?: unknown;     // Default value if not provided
  enum?: string[];       // Allowed values (for string/number types)
}
```

### Tool Options

```typescript
{
  name: 'tool_name',           // Unique identifier (snake_case recommended)
  description: 'What it does', // Critical: the LLM uses this to decide when to call the tool
  category: 'domain',          // Grouping category
  requiresApproval: false,     // If true, requires user confirmation before execution
  timeout: 30000,              // Max execution time in ms (default: 30s)
  parameters: [...],           // Input parameters
  returns: {...},              // Return type description
  execute: async (args) => {   // The actual implementation
    return { result: '...' };
  },
}
```

### Return Values

The `execute` function should return a plain object. This object is serialized to JSON and sent back to the LLM as the tool call result.

```typescript
// Good: return structured data
return { status: 'success', items: [...], count: 42 };

// Good: return simple result
return { output: 'processed text here' };

// Bad: don't return undefined or throw without reason
```

### Error Handling

Throw an error to indicate failure. The error message will be shown to the LLM:

```typescript
execute: async (args) => {
  const file = args.path as string;
  if (!file) throw new Error('File path is required');

  try {
    const content = await readFile(file, 'utf-8');
    return { content, size: content.length };
  } catch (err) {
    throw new Error(`Cannot read file: ${err.message}`);
  }
}
```

## Skill Categories

Use the appropriate category for your skill:

| Category | Use Case |
|---|---|
| `programming` | Code, DevOps, CI/CD, testing |
| `healthcare` | Medical, health metrics, clinical |
| `productivity` | Notes, calendar, email, tasks |
| `marketing` | SEO, content, social media, analytics |
| `finance` | Accounting, invoicing, budgets |
| `ecommerce` | Products, orders, inventory |
| `smart-home` | IoT devices, automation |
| `communication` | Messaging, notifications |
| `custom` | Anything else |

## Writing Good Tool Descriptions

The `description` field is critical — it's what the LLM reads to decide when to use your tool. Follow these guidelines:

**Do:**
- Be specific about what the tool does
- Mention input/output types
- Include common use cases
- State any limitations

**Don't:**
- Be vague ("does stuff")
- Use jargon the LLM might not understand
- Write overly long descriptions

**Examples:**

```typescript
// Good
description: 'Execute a shell command and return stdout/stderr. Supports common Unix commands. Dangerous commands (rm -rf, mkfs, etc.) are blocked for safety.'

// Bad
description: 'Runs commands'

// Good
description: 'Analyze symptoms and return possible conditions with triage level (EMERGENCY, URGENT, SEMI-URGENT, NON-URGENT). Input should be a comma-separated list of symptoms.'

// Bad
description: 'Medical analysis tool'
```

## Advanced Patterns

### Shared State Within a Skill

Use closure variables for in-memory state:

```typescript
export const mySkill = defineSkill({
  id: 'stateful-skill',
  // ...

  tools: (() => {
    // Shared state for all tools in this skill
    const store = new Map<string, unknown>();

    return [
      {
        name: 'store_set',
        // ...
        execute: async (args) => {
          store.set(args.key as string, args.value);
          return { stored: true };
        },
      },
      {
        name: 'store_get',
        // ...
        execute: async (args) => {
          return { value: store.get(args.key as string) ?? null };
        },
      },
    ];
  })(),
});
```

### Tools That Call Other Tools

Access the ToolRegistry if you need cross-tool calls:

```typescript
// This is handled by the Agent's tool-calling loop.
// If your tool needs another tool's output, return instructions
// and let the LLM chain the calls naturally.
```

### Configuration

Skills can define config fields that users set when activating:

```typescript
export const mySkill = defineSkill({
  id: 'configurable-skill',
  // ...
  config: [
    {
      key: 'apiEndpoint',
      label: 'API Endpoint',
      type: 'string',
      description: 'The base URL for the external API',
      required: true,
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'secret',
      description: 'Authentication key',
      required: true,
    },
  ],
  tools: [/* ... */],
});
```

Users activate with config:

```typescript
await agent.skills.activate('configurable-skill', {
  apiEndpoint: 'https://api.example.com',
  apiKey: 'sk-...',
});
```

## Existing Skill Packs as Reference

### Programming Skill (11 tools)

| Tool | Description |
|---|---|
| `shell_exec` | Execute shell commands (with blocked command list) |
| `file_read` | Read file contents |
| `file_write` | Write/create files |
| `file_list` | List directory contents (recursive) |
| `git_status` | Get git repository status |
| `git_diff` | Show git diff |
| `git_commit` | Create a git commit |
| `git_log` | Show git history |
| `run_tests` | Auto-detect and run test suites (vitest/jest/pytest/cargo/go) |
| `code_search` | Grep search across files |
| `project_analyze` | Detect language, framework, and project structure |

### Healthcare Skill (11 tools)

| Tool | Description |
|---|---|
| `symptom_analyze` | Analyze symptoms with triage levels |
| `medication_check_interaction` | Check drug-drug interactions |
| `medication_schedule` | CRUD for medication schedules |
| `health_metrics_log` | Log health metrics (BP, sugar, weight, HR, temp, SpO2) |
| `health_metrics_query` | Query metrics with statistics |
| `appointment_manage` | CRUD for medical appointments |
| `medical_record` | CRUD for medical records with search |
| `health_report` | Generate comprehensive health reports |
| `clinical_note` | Create SOAP-format clinical notes |
| `icd_lookup` | Look up ICD-10 diagnostic codes |

## Testing Your Skill

### Manual Testing via Chat

Start the dev server and test via the chat interface:

```
User: "Use my_tool with input 'hello world'"
Agent: [calls my_tool] → "Here's the result..."
```

### Manual Testing via API

```bash
# Check your tool is registered
curl http://localhost:3001/api/tools | jq '.tools[] | select(.name == "my_tool")'

# Test via chat
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Use my_tool with input hello"}'
```

## Checklist for New Skills

- [ ] Unique skill `id` (kebab-case)
- [ ] Clear `description` for the skill and each tool
- [ ] All tool `parameters` have `description` and correct `type`
- [ ] `execute` functions handle errors gracefully
- [ ] Exported from `packages/skills/src/index.ts`
- [ ] Registered in `packages/server/src/index.ts`
- [ ] Tested via chat or API
