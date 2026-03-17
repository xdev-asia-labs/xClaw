# API Reference

xClaw exposes a REST API and WebSocket endpoint. The server runs on port `3001` by default.

## Base URL

```
http://localhost:3001
```

## Authentication

Currently no authentication is required (development mode). Authentication will be added in a future release.

---

## REST API Endpoints

### Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "agent": "xClaw",
  "uptime": 123.456
}
```

---

### Chat

#### Send a Chat Message

```
POST /api/chat
```

Sends a message to the AI agent and returns the response. The agent may call tools internally before responding.

**Request Body:**
```json
{
  "sessionId": "optional-session-uuid",
  "message": "Hello, analyze this code for me"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | No | Session ID for conversation continuity. Auto-generated if omitted. |
| `message` | string | Yes | The user's message |

**Response:**
```json
{
  "sessionId": "abc-123-def",
  "response": "I've analyzed the code. Here are my findings..."
}
```

**Error Response (400):**
```json
{ "error": "message is required" }
```

---

### Skills

#### List All Skills

```
GET /api/skills
```

Returns all registered skills (both active and inactive).

**Response:**
```json
{
  "skills": [
    {
      "id": "programming",
      "name": "Programming & DevOps",
      "version": "1.0.0",
      "description": "Shell, Git, file management, testing tools",
      "category": "programming",
      "active": true,
      "tools": [
        { "name": "shell_exec", "description": "Execute a shell command" }
      ]
    }
  ]
}
```

#### List Active Skills

```
GET /api/skills/active
```

Returns only currently activated skills.

#### Activate a Skill

```
POST /api/skills/:id/activate
```

**URL Parameters:**
| Parameter | Description |
|---|---|
| `id` | Skill ID (e.g., `programming`, `healthcare`) |

**Request Body (optional):**
```json
{
  "config": {
    "someOption": "value"
  }
}
```

**Response:**
```json
{ "success": true }
```

#### Deactivate a Skill

```
POST /api/skills/:id/deactivate
```

**Response:**
```json
{ "success": true }
```

---

### Tools

#### List All Available Tools

```
GET /api/tools
```

Returns all tool definitions from active skills.

**Response:**
```json
{
  "tools": [
    {
      "name": "shell_exec",
      "description": "Execute a shell command",
      "category": "programming",
      "parameters": [
        { "name": "command", "type": "string", "description": "The command to run", "required": true }
      ],
      "returns": { "name": "output", "type": "object", "description": "Command output" },
      "requiresApproval": true
    }
  ]
}
```

#### List Tools by Category

```
GET /api/tools/:category
```

| Parameter | Description |
|---|---|
| `category` | Tool category (e.g., `programming`, `healthcare`, `memory`) |

---

### Workflows

#### List All Workflows

```
GET /api/workflows
```

**Response:**
```json
{
  "workflows": [
    {
      "id": "wf-123",
      "name": "Code Review Pipeline",
      "description": "Automated code review workflow",
      "version": 1,
      "nodes": [],
      "edges": [],
      "variables": [],
      "trigger": { "type": "manual" },
      "enabled": true,
      "createdAt": "2026-03-16T10:00:00Z",
      "updatedAt": "2026-03-16T10:00:00Z"
    }
  ]
}
```

#### Get a Workflow

```
GET /api/workflows/:id
```

**Response:** Full workflow object (see above).

**Error Response (404):**
```json
{ "error": "Workflow not found" }
```

#### Create a Workflow

```
POST /api/workflows
```

**Request Body:**
```json
{
  "name": "My Workflow",
  "description": "Does something useful",
  "nodes": [
    {
      "id": "node_1",
      "type": "trigger",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Start", "config": { "triggerType": "manual" } },
      "inputs": [],
      "outputs": [{ "id": "out_1", "name": "data", "type": "any" }]
    }
  ],
  "edges": [],
  "variables": [],
  "trigger": { "id": "t1", "type": "manual", "name": "Manual", "description": "Manual trigger", "config": {} },
  "enabled": true
}
```

**Response:** The created workflow object with `id`, `version`, `createdAt`, `updatedAt` populated.

#### Update a Workflow

```
PUT /api/workflows/:id
```

**Request Body:** Same as create. The `id` and `version` are managed server-side.

**Response:** Updated workflow object (version incremented).

#### Delete a Workflow

```
DELETE /api/workflows/:id
```

**Response:**
```json
{ "success": true }
```

#### Execute a Workflow

```
POST /api/workflows/:id/execute
```

**Request Body:**
```json
{
  "triggerData": {
    "customKey": "customValue"
  }
}
```

**Response:**
```json
{
  "id": "exec-uuid",
  "workflowId": "wf-123",
  "status": "completed",
  "startedAt": "2026-03-16T10:00:00Z",
  "completedAt": "2026-03-16T10:00:01Z",
  "nodeResults": {},
  "variables": { "_trigger": { "customKey": "customValue" } }
}
```

---

### Agent Configuration

#### Get Agent Config

```
GET /api/agent/config
```

Returns the current agent configuration. API keys are masked.

**Response:**
```json
{
  "id": "xclaw-main",
  "name": "xClaw",
  "persona": "A helpful AI assistant",
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "***",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "enabledSkills": ["programming", "healthcare"],
  "memory": { "enabled": true, "maxEntries": 1000 }
}
```

#### Update Agent Config

```
PATCH /api/agent/config
```

**Request Body:** Partial config object. Only the fields you want to update.
```json
{
  "name": "My Agent",
  "llm": { "model": "gpt-4o-mini" }
}
```

**Response:**
```json
{ "success": true }
```

---

### Memory

#### Search Memory

```
POST /api/memory/search
```

**Request Body:**
```json
{
  "query": "user preferences for code style",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "mem-123",
      "type": "preference",
      "content": "User prefers TypeScript with strict mode",
      "tags": ["preference", "coding"],
      "createdAt": "2026-03-16T10:00:00Z"
    }
  ]
}
```

#### Save Memory

```
POST /api/memory/save
```

**Request Body:**
```json
{
  "content": "The project uses PostgreSQL 16",
  "type": "fact",
  "tags": ["database", "tech-stack"]
}
```

**Response:**
```json
{
  "entry": {
    "id": "mem-456",
    "type": "fact",
    "content": "The project uses PostgreSQL 16",
    "tags": ["database", "tech-stack"],
    "createdAt": "2026-03-16T10:00:00Z"
  }
}
```

---

## WebSocket API

### Connection

```
ws://localhost:3001/ws
```

### Server → Client Events

The server bridges internal EventBus events to WebSocket clients:

| Event Type | Payload | Description |
|---|---|---|
| `agent:response` | `{ sessionId, content, usage }` | Agent generated a response |
| `tool:started` | `{ toolName, toolCallId }` | Tool execution started |
| `tool:completed` | `{ toolCallId, result, duration }` | Tool execution completed |
| `tool:failed` | `{ toolCallId, error }` | Tool execution failed |
| `workflow:started` | `{ workflowId, executionId }` | Workflow execution started |
| `workflow:completed` | `{ workflowId, executionId, status }` | Workflow execution finished |
| `workflow:node:started` | `{ nodeId, nodeType, label }` | Workflow node started |
| `skill:activated` | `{ skillId }` | Skill was activated |
| `skill:deactivated` | `{ skillId }` | Skill was deactivated |

**Message format:**
```json
{
  "type": "tool:completed",
  "payload": { "toolCallId": "tc-123", "result": { "output": "..." }, "duration": 42 },
  "source": "tool-registry",
  "timestamp": "2026-03-16T10:00:00.123Z"
}
```

### Client → Server Messages

| Type | Fields | Description |
|---|---|---|
| `chat` | `{ sessionId, message }` | Send a chat message (response comes as `agent:response` event) |
| `workflow:execute` | `{ workflowId, triggerData? }` | Trigger workflow execution |

**Example:**
```json
{
  "type": "chat",
  "sessionId": "session-123",
  "message": "Run my tests"
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

| Status Code | Meaning |
|---|---|
| `400` | Bad request (missing required fields) |
| `404` | Resource not found |
| `500` | Internal server error |
