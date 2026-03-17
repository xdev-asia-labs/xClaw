# System Architecture

## Overview

xClaw is an open-source AI Agent platform built as a TypeScript monorepo. It provides a pluggable skill system, a visual workflow builder, and multi-LLM support — designed to be extended per industry (programming, healthcare, finance, etc.).

## High-Level Architecture

<img src="/diagrams/high-level-architecture.png" alt="High-Level Architecture" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

## Package Structure

The project is organized as an npm workspaces monorepo with 5 packages:

| Package | Purpose | Dependencies |
|---|---|---|
| `@xclaw/shared` | Type definitions, constants, interfaces | None |
| `@xclaw/core` | Agent engine, LLM, memory, tools, workflow | `@xclaw/shared` |
| `@xclaw/skills` | Industry-specific skill packs | `@xclaw/shared`, `@xclaw/core` |
| `@xclaw/server` | REST API + WebSocket server | `@xclaw/core`, `@xclaw/skills` |
| `@xclaw/web` | React frontend with workflow builder | Standalone (API client) |

### Dependency Graph

```
shared ← core ← skills ← server
                              ↑ HTTP/WS
                             web (standalone)
```

### Agent Core Components

<img src="/diagrams/agent-core.png" alt="Agent Core Components" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

## Core Components

### 1. Agent (`packages/core/src/agent/agent.ts`)

The central orchestrator. On initialization it wires up all subsystems:

| Subsystem | Purpose |
|---|---|
| **EventBus** | Internal pub/sub for decoupled communication |
| **LLMRouter** | Multi-provider LLM abstraction layer |
| **MemoryManager** | Vector memory with semantic search |
| **ToolRegistry** | Tool registration, approval, and execution |
| **SkillManager** | Plugin loader for skill packs |
| **WorkflowEngine** | Visual workflow execution engine |

**Chat Loop Algorithm:**
1. User message is saved to conversation history
2. System prompt is built with persona + relevant memories
3. Conversation history is loaded (last 20 messages)
4. LLM is called with messages + available tool definitions
5. If LLM returns `tool_calls` → execute tools → feed results back → repeat (max 10 iterations)
6. Final text response is saved and returned

### 2. LLM Router (`packages/core/src/llm/llm-router.ts`)

Adapter pattern supporting multiple LLM providers:

```
LLMRouter
├── OpenAIAdapter   — OpenAI API (also used for Ollama via compatible API)
├── AnthropicAdapter — Anthropic Claude API with native tool support
└── Custom adapters via registerAdapter()
```

Each adapter implements:
- `chat(messages, tools?)` → `LLMResponse`
- `embed?(text)` → `number[]` (optional, for memory embeddings)

### 3. EventBus (`packages/core/src/agent/event-bus.ts`)

Lightweight pub/sub system enabling decoupled communication:

- Supports wildcard listeners (`workflow:*`)
- Events: `agent:response`, `tool:*`, `workflow:*`, `skill:*`
- Used by ToolRegistry, WorkflowEngine, and Server (WebSocket bridge)

### 4. Memory Manager (`packages/core/src/memory/memory-manager.ts`)

Two-tier memory system:

| Tier | Purpose |
|---|---|
| **Conversation History** | Per-session message history (keyed by sessionId) |
| **Long-term Memory** | Semantic vector store with cosine similarity search |

- `remember(content, type, tags)` — Store a memory entry with optional embedding
- `recall(query, limit)` — Semantic search across stored memories
- `forget(id)` — Remove a memory entry
- Built-in tools (`memory_save`, `memory_search`) let the LLM manage its own memory

### 5. Tool Registry (`packages/core/src/tools/tool-registry.ts`)

Central registry for all executable tools:

- `register(definition, executor)` — Register a tool with its handler function
- `execute(toolCall)` — Run a tool with timeout and optional approval callback
- `executeAll(toolCalls)` — Parallel execution of multiple tool calls
- Emits events: `tool:started`, `tool:completed`, `tool:failed`
- Supports `requiresApproval` flag for sensitive operations

### 6. Skill Manager (`packages/core/src/skills/skill-manager.ts`)

Plugin system for loading domain-specific capabilities:

- `register(skill)` — Register a skill manifest + tools
- `activate(skillId)` — Activate a skill, making its tools available
- `deactivate(skillId)` — Deactivate a skill, removing its tools
- Skills use `defineSkill()` helper for type-safe definition
- Hot-loadable: skills can be activated/deactivated at runtime

### 7. Workflow Engine (`packages/core/src/workflow/workflow-engine.ts`)

Executes visual workflows created in the drag-and-drop builder:

- BFS graph traversal from trigger nodes
- 16 built-in node type handlers
- Template resolution (e.g. `nodeId.outputKey` syntax)
- Conditional edge routing
- Custom handler registration via `registerNodeHandler()`

See [Workflow Engine Design](workflow-engine.md) for details.

## Data Flow

### Chat Request Flow

<img src="/diagrams/chat-request-flow.png" alt="Chat Request Flow" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

### Workflow Execution Flow

<img src="/diagrams/workflow-execution-flow.png" alt="Workflow Execution Flow" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

### Real-time WebSocket Flow

<img src="/diagrams/websocket-flow.png" alt="WebSocket Real-time Event Flow" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

## Type System

All shared types are defined in `@xclaw/shared` (`packages/shared/src/types/index.ts`):

| Category | Key Types |
|---|---|
| **LLM** | `LLMProvider`, `LLMConfig`, `LLMMessage`, `LLMResponse` |
| **Tools** | `ToolDefinition`, `ToolParameter`, `ToolCall`, `ToolResult` |
| **Skills** | `SkillManifest`, `SkillCategory`, `SkillConfigField` |
| **Triggers** | `TriggerDefinition`, `TriggerType` |
| **Workflows** | `Workflow`, `WorkflowNode`, `WorkflowNodeType`, `WorkflowEdge`, `WorkflowExecution`, `NodeExecutionResult` |
| **Memory** | `MemoryEntry`, `ConversationMessage` |
| **Messaging** | `ChatPlatform`, `IncomingMessage`, `OutgoingMessage` |
| **Config** | `AgentConfig` |

## Frontend Architecture

<img src="/diagrams/frontend-architecture.png" alt="Frontend Architecture" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

## Security Model

| Layer | Mechanism |
|---|---|
| **Tool Execution** | `requiresApproval` flag, per-tool timeout |
| **Shell Commands** | Blocked command list (rm -rf, mkfs, etc.) |
| **API Keys** | Server-side only, masked in config responses |
| **LLM** | Max iteration limit (10) to prevent infinite tool loops |
| **Code Execution** | Sandboxed `new Function()` in workflow code nodes |
| **Healthcare** | Medical disclaimer on all health-related outputs |

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.7+ (ES2022 target) |
| Frontend | React 19, Vite 6, Tailwind CSS 3.4, React Flow 12, Zustand 5 |
| Backend | Node.js 20+, Express 5, WebSocket (ws) |
| LLM | OpenAI API, Anthropic API, Ollama (OpenAI-compatible) |
| Icons | Lucide React |
| Build | npm workspaces, TypeScript project references |
| Deploy | Docker, docker-compose |

## Future Architecture Plans

- **Database Layer**: Replace in-memory stores with PostgreSQL (workflows, memories) and Redis (sessions, cache)
- **Auth**: JWT-based authentication with role-based access control
- **Queue**: Bull/BullMQ for async workflow execution
- **Storage**: S3-compatible object storage for file attachments
- **Observability**: OpenTelemetry tracing for agent execution flow
