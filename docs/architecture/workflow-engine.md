# Workflow Engine Design

The Workflow Engine executes visual workflows created in the drag-and-drop builder. It uses a BFS (Breadth-First Search) graph traversal algorithm to walk through connected nodes, executing each node's handler and passing data along edges.

## Core Concepts

| Concept | Description |
|---|---|
| **Workflow** | A directed graph of nodes and edges, stored as a JSON document |
| **Node** | A single unit of work (LLM call, tool execution, condition, etc.) |
| **Edge** | A connection between two nodes, optionally with a condition |
| **Execution** | A running instance of a workflow with its own variable scope |
| **Context** | Runtime state: variables, execution metadata, service references |

## Node Types

The engine supports 16 node types across 6 categories:

### Trigger Nodes

| Type | Description | Outputs |
|---|---|---|
| `trigger` | Entry point — passes trigger data through | `data`: the trigger payload |

### AI Nodes

| Type | Description | Config | Outputs |
|---|---|---|---|
| `llm-call` | Send a prompt to the LLM | `prompt`, `systemPrompt`, `model` | `response`, `usage` |

### Action Nodes

| Type | Description | Config | Outputs |
|---|---|---|---|
| `tool-call` | Execute a registered tool | `toolName`, `arguments` | `result`, `success`, `error` |
| `http-request` | Make an HTTP API call | `url`, `method`, `headers`, `body` | `status`, `data`, `ok` |
| `code` | Execute JavaScript code | `code` | `result` (whatever the code returns) |
| `notification` | Send a notification | `message`, `channel` | `sent`, `channel` |

### Control Flow Nodes

| Type | Description | Config | Outputs |
|---|---|---|---|
| `condition` | If/else branch | `expression` | `result` (boolean), `branch` ("true"/"false") |
| `loop` | Repeat actions | `maxIterations`, `condition` | Loop outputs |
| `switch` | Multi-branch routing | `cases` | Case outputs |
| `wait` | Pause execution | `seconds` | `waited` (actual ms) |
| `merge` | Merge branches | — | Merged inputs |

### Data Nodes

| Type | Description | Config | Outputs |
|---|---|---|---|
| `transform` | Transform data with templates | `template` | `result` |
| `memory-read` | Read from agent memory | `query` | `results` |
| `memory-write` | Write to agent memory | `content`, `type`, `tags` | `entry` |
| `sub-workflow` | Call another workflow | `workflowId` | Sub-workflow outputs |

### Output Nodes

| Type | Description | Outputs |
|---|---|---|
| `output` | Terminal node — final output | Pass-through of inputs |

## Execution Algorithm

### BFS Execution Algorithm

<img src="/diagrams/bfs-execution.png" alt="Workflow BFS Execution Algorithm" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

## Template Resolution

::: v-pre
Node configs support template strings that reference variables from the execution context:

```
{{variableName}}              → Simple variable lookup
{{nodeId.outputKey}}          → Output from a specific node
{{_trigger.someField}}        → Trigger data
```

**Resolution algorithm:**
1. Find all `{{path.to.value}}` patterns
2. Split path by `.`
3. Walk the context.variables object following the path
4. Replace the template with the resolved value (or empty string if not found)

**Example:**
```
Prompt: "Analyze this code: {{node_1.result}}"
→ Resolves to: "Analyze this code: function hello() { ... }"
```
:::

## Condition Evaluation

Condition nodes and conditional edges use JavaScript expressions evaluated against the variables context:

```javascript
// Expression examples:
"status === 200"
"result.score > 0.8"
"branch === 'true'"
"items.length > 0"
```

**Safety measures:**
- Expressions are sanitized: only alphanumeric, dots, comparison operators, and boolean operators are allowed
- Evaluated via `new Function('vars', 'with(vars) { return !!(expression); }')` — no access to global scope
- Returns `false` on any evaluation error

## Data Flow Between Nodes

Data flows through the workflow via edges. Each edge connects a source node's output port to a target node's input port.

<img src="/diagrams/data-flow-nodes.png" alt="Data Flow Between Nodes" style="max-width: 100%; border-radius: 12px; margin: 16px 0;" />

## Built-in Handler Implementations

### `trigger`
Simply returns the trigger data from the execution context.
```
Output: { data: context.variables._trigger }
```

### `llm-call`
1. Resolves prompt template against context variables
2. Builds messages array (optional system prompt + user prompt)
3. Calls the LLM adapter
4. Returns response text and usage stats

### `tool-call`
1. Reads `toolName` from node config
2. Resolves template strings in arguments
3. Calls `ToolRegistry.execute()`
4. Returns tool result, success flag, and any error

### `condition`
1. Reads expression from config
2. Evaluates against context variables + inputs
3. Returns `{ result: boolean, branch: "true" | "false" }`
4. Downstream edges can filter on the `branch` value

### `http-request`
1. Resolves URL template
2. Makes HTTP fetch with configured method, headers, body
3. Parses response as JSON (falls back to text)
4. Returns `{ status, data, ok }`

### `code`
1. Reads code string from config
2. Creates a sandboxed function: `new Function('inputs', 'context', code)`
3. Executes with inputs and a safe subset of context
4. Returns whatever the code returns

### `wait`
```javascript
await new Promise(resolve => setTimeout(resolve, seconds * 1000));
return { waited: seconds * 1000 };
```

### `transform`
Resolves a template string against variables and inputs. Useful for reshaping data between nodes.

### `memory-read` / `memory-write`
Delegates to the Agent's MemoryManager for reading/writing long-term memory.

### `notification`
Resolves the message template and emits a notification event.

## Custom Node Handlers

You can register custom node type handlers:

```typescript
engine.registerNodeHandler('my-custom-type', async (node, inputs, context) => {
  // Your custom logic
  const result = await doSomething(node.data.config, inputs);
  return { output: result };
});
```

This allows skills to extend the workflow engine with domain-specific node types.

## Execution Events

The engine emits events throughout execution for real-time monitoring:

| Event | When | Payload |
|---|---|---|
| `workflow:started` | Execution begins | `workflowId`, `executionId` |
| `workflow:node:started` | Node handler starts | `nodeId`, `nodeType`, `label` |
| `workflow:node:completed` | Node handler finishes | `nodeId`, `output`, `duration` |
| `workflow:completed` | Execution ends | `workflowId`, `executionId`, `status` |

These events are forwarded to WebSocket clients for live UI updates.

## Workflow JSON Schema

```json
{
  "id": "wf-uuid",
  "name": "My Workflow",
  "description": "What this workflow does",
  "version": 1,
  "nodes": [
    {
      "id": "node_1",
      "type": "trigger",
      "position": { "x": 250, "y": 50 },
      "data": {
        "label": "Start",
        "description": "Manual trigger",
        "config": { "triggerType": "manual" }
      },
      "inputs": [],
      "outputs": [{ "id": "out_data", "name": "data", "type": "any" }]
    },
    {
      "id": "node_2",
      "type": "llm-call",
      "position": { "x": 250, "y": 200 },
      "data": {
        "label": "Analyze",
        "config": {
          "prompt": "Analyze: {'{'}{'{'} node_1.data {'}'}{'}'}",
          "systemPrompt": "You are a code reviewer."
        }
      },
      "inputs": [{ "id": "in_data", "name": "data", "type": "any" }],
      "outputs": [{ "id": "out_response", "name": "response", "type": "string" }]
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "sourcePort": "out_data",
      "target": "node_2",
      "targetPort": "in_data"
    }
  ],
  "variables": [
    { "name": "maxRetries", "type": "number", "defaultValue": 3 }
  ],
  "trigger": {
    "id": "t1",
    "type": "manual",
    "name": "Manual Trigger",
    "description": "Triggered by user",
    "config": {}
  },
  "enabled": true,
  "createdAt": "2026-03-16T10:00:00Z",
  "updatedAt": "2026-03-16T10:00:00Z"
}
```

## Limitations & Future Work

| Current Limitation | Planned Solution |
|---|---|
| In-memory workflow storage | PostgreSQL persistence |
| No parallel branch execution | Promise.all for independent branches |
| No loop node implementation | Implement iteration with break conditions |
| No sub-workflow support | Recursive engine invocation |
| Basic condition evaluation | Expression parser (e.g., `expr-eval` library) |
| No execution history | Database-backed execution log |
| No retry/error handling nodes | Add retry, catch, and fallback node types |
| No workflow versioning | Version tracking with diff and rollback |
