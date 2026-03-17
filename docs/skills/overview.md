# Skills Overview

xClaw comes with **11 pre-built AI agent skill packs** covering diverse industry domains. Each skill pack provides a set of specialized tools that the AI agent can use.

## Built-in Skills

| Skill | Category | Tools | Description |
|-------|----------|-------|-------------|
| **Programming & DevOps** | Programming | 11 | Shell execution, file management, Git, code search, test runner |
| **Healthcare Assistant** | Healthcare | 11 | Symptom analysis, medication management, health metrics, clinical notes |

## Installable Skills (Agent Hub)

| Skill | Category | Tools | Description |
|-------|----------|-------|-------------|
| **Data Analytics** | Analytics | 6 | Query datasets, transform data, generate charts, create reports |
| **DevOps Engineer** | DevOps | 6 | Docker management, CI/CD pipelines, log analysis, infrastructure monitoring |
| **Content Writer** | Content | 5 | Article generation, SEO analysis, translation, summarization, proofreading |
| **Research Agent** | Research | 5 | Web search, data collection, fact-checking, report generation |
| **Sales & CRM** | Sales | 5 | Lead management, email outreach, pipeline tracking, sales analytics |
| **Project Manager** | Project Mgmt | 5 | Task tracking, sprint planning, progress reports, risk assessment |
| **Learning & Training** | Learning | 5 | Quiz generation, flashcards, curriculum planning, study recommendations |
| **Finance & Accounting** | Finance | 5 | Budget tracking, invoicing, expense reports, tax calculation, forecasting |
| **Design Assistant** | Design | 5 | Color palettes, UI mockups, icon suggestions, layout analysis |

## How Skills Work

Each skill is defined using the `defineSkill()` helper from `@xclaw/core`:

```typescript
import { defineSkill } from '@xclaw/core';

export const mySkill = defineSkill({
    id: 'my-custom-skill',
    name: 'My Custom Skill',
    description: 'What this skill does',
    version: '1.0.0',
    category: 'programming',
    tools: [
        {
            name: 'my_tool',
            description: 'What this tool does',
            parameters: {
                type: 'object',
                properties: {
                    input: { type: 'string', description: 'Input parameter' },
                },
                required: ['input'],
            },
            execute: async ({ input }) => {
                // Tool implementation
                return { result: `Processed: ${input}` };
            },
        },
    ],
});
```

## Skill Lifecycle

```
Define → Register → Activate → Tools Available → Deactivate
```

1. **Define** — Create a `SkillManifest` with tools using `defineSkill()`
2. **Register** — `SkillManager.register(skill)` adds the skill to the registry
3. **Activate** — `SkillManager.activate(skillId)` makes tools available to the AI
4. **Deactivate** — `SkillManager.deactivate(skillId)` removes tools from the AI

Skills can be activated/deactivated at runtime — hot-swappable without server restart.

## Next Steps

- [Creating Custom Skills](/skills/creating-skills) — Build your own skill pack
- [Agent Hub](/agent-hub/overview) — Browse and manage skills from the marketplace
