# API Specification
## xClaw Model Management Skill
**Version:** 3.0.0  
**Date:** 2026-03-16  
**Base URL:** `ws://127.0.0.1:18789/ws` (WebSocket) | `http://127.0.0.1:18789` (REST)

---

## 1. API Overview

Model Management Skill exposes APIs qua 3 channels:

| Channel | Use Case | Format |
|---|---|---|
| **Skill Tools** | Agent LLM gọi qua tool calling | `SkillContext.toolRegistry` |
| **REST API** | Web UI, external clients | HTTP JSON |
| **WebSocket Events** | Real-time updates (pull progress, health changes) | WS JSON |

---

## 2. REST API Endpoints

### 2.1 Model Profiles

#### `GET /api/models`
List all model profiles.

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `provider` | string | No | Filter: `ollama`, `openai`, `anthropic`, `google`, `custom` |
| `status` | string | No | Filter: `available`, `unavailable`, `error` |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "019505a3-7c00-7000-8000-000000000001",
        "name": "Qwen 2.5 7B",
        "provider": "ollama",
        "modelId": "qwen2.5:7b",
        "baseUrl": "http://localhost:11434",
        "isDefault": true,
        "isActive": true,
        "status": "available",
        "parameters": {
          "temperature": 0.7,
          "maxTokens": 4096,
          "topP": 0.9
        },
        "capabilities": {
          "toolCalling": true,
          "vision": false,
          "embedding": false
        },
        "stats": {
          "tokensPerSecond": 10.0,
          "totalTokensUsed": 150000,
          "totalRequests": 423
        },
        "createdAt": "2026-03-16T10:00:00Z",
        "updatedAt": "2026-03-16T12:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 4,
      "totalPages": 1
    }
  }
}
```

---

#### `POST /api/models`
Create a new model profile.

**Request Body:**
```json
{
  "name": "GPT-4o Mini",
  "provider": "openai",
  "modelId": "gpt-4o-mini",
  "apiKey": "sk-abc123...",
  "baseUrl": "https://api.openai.com/v1",
  "parameters": {
    "temperature": 0.7,
    "maxTokens": 4096,
    "topP": 1.0
  },
  "capabilities": {
    "toolCalling": true,
    "vision": true,
    "embedding": false
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Display name (3-100 chars) |
| `provider` | enum | Yes | `ollama`, `openai`, `anthropic`, `google`, `custom` |
| `modelId` | string | Yes | Provider model identifier |
| `apiKey` | string | No | API key (encrypted in PG18) |
| `baseUrl` | string | No | Custom API base URL |
| `parameters` | object | No | LLM parameters |
| `capabilities` | object | No | Model capabilities |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "019505a3-7c00-7000-8000-000000000005",
    "name": "GPT-4o Mini",
    "provider": "openai",
    "modelId": "gpt-4o-mini",
    "hasApiKey": true,
    "status": "available",
    "createdAt": "2026-03-16T14:00:00Z"
  }
}
```

**Note:** `apiKey` is NEVER returned in responses. Only `hasApiKey: boolean`.

---

#### `PUT /api/models/:id`
Update a model profile.

**Request Body:** Partial model profile (only changed fields).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "previous": { "temperature": 0.7 },
    "current": { "temperature": 0.9 },
    "updatedAt": "2026-03-16T15:00:00Z"
  }
}
```

Uses PostgreSQL 18 `OLD`/`NEW` RETURNING to return both previous and current values.

---

#### `DELETE /api/models/:id`
Soft-delete a model profile.

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "...", "deletedAt": "2026-03-16T15:30:00Z" }
}
```

**Error 409:**
```json
{
  "success": false,
  "error": { "code": "MODEL_IS_ACTIVE", "message": "Cannot delete active/default model" }
}
```

---

#### `GET /api/models/:id`
Get single model profile.

**Response 200:**
```json
{
  "success": true,
  "data": { /* full model profile */ }
}
```

---

### 2.2 Model Operations

#### `POST /api/models/switch`
Switch active model.

**Request Body:**
```json
{
  "modelId": "019505a3-...",
  "scope": "default"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `modelId` | string (uuid) | Yes | Profile ID to switch to |
| `scope` | enum | No | `default` (global) or `session` (current only) |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "previousModel": { "id": "...", "name": "Qwen 2.5 7B" },
    "activeModel": { "id": "...", "name": "GPT-4o Mini" },
    "scope": "default"
  }
}
```

---

#### `GET /api/models/active`
Get currently active model.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "model": { /* active model profile */ },
    "scope": "default",
    "since": "2026-03-16T10:00:00Z"
  }
}
```

---

#### `POST /api/models/:id/test`
Test model connection.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "reachable": true,
    "latencyMs": 234,
    "tokensPerSecond": 10.5,
    "testResponse": "Hello! I'm working correctly."
  }
}
```

---

### 2.3 Benchmark

#### `POST /api/models/:id/benchmark`
Run benchmark on a model.

**Request Body:**
```json
{
  "tests": ["speed", "code", "tool_calling", "vietnamese"]
}
```

| Test | Description |
|---|---|
| `speed` | Token generation speed (tokens/sec) |
| `code` | Code generation quality score |
| `tool_calling` | Tool calling support & accuracy |
| `vietnamese` | Vietnamese language quality |
| `context_length` | Maximum context handling |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "019505a3-...",
    "modelId": "019505a3-...",
    "results": {
      "speed": { "tokensPerSecond": 10.0, "firstTokenMs": 120 },
      "code": { "score": 7.5, "details": "Good Python, weak TypeScript generics" },
      "tool_calling": { "supported": true, "accuracy": 0.85 },
      "vietnamese": { "score": 8.0, "details": "Natural Vietnamese, good diacritics" }
    },
    "duration": 45000,
    "timestamp": "2026-03-16T16:00:00Z"
  }
}
```

---

#### `GET /api/benchmarks`
List benchmark history.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `modelId` | string | Filter by model |
| `test` | string | Filter by test type |
| `limit` | number | Results per page |

---

### 2.4 Ollama Operations

#### `GET /api/ollama/models`
List local Ollama models.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "name": "qwen2.5:7b",
        "size": 4683075584,
        "sizeHuman": "4.7 GB",
        "modifiedAt": "2026-03-10T08:00:00Z",
        "details": {
          "format": "gguf",
          "family": "qwen2",
          "parameterSize": "7.6B",
          "quantization": "Q4_K_M"
        },
        "registered": true
      }
    ]
  }
}
```

---

#### `POST /api/ollama/pull`
Pull a model from Ollama registry.

**Request Body:**
```json
{
  "name": "qwen2.5:3b",
  "autoRegister": true
}
```

**Response 202 (Accepted):**
```json
{
  "success": true,
  "data": {
    "taskId": "pull-qwen2.5-3b-1710590400",
    "message": "Pull started. Subscribe to WebSocket for progress."
  }
}
```

Progress is streamed via WebSocket events (see Section 3).

---

#### `DELETE /api/ollama/models/:name`
Remove a model from Ollama.

**Response 200:**
```json
{
  "success": true,
  "data": { "name": "gemma2:2b", "removed": true }
}
```

---

### 2.5 Usage & Statistics

#### `GET /api/usage`
Get token usage statistics.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `modelId` | string | Filter by model |
| `from` | ISO date | Start date |
| `to` | ISO date | End date |
| `groupBy` | string | `day`, `week`, `month`, `model` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTokens": 1500000,
      "totalRequests": 4230,
      "estimatedCost": 2.45,
      "period": { "from": "2026-03-01", "to": "2026-03-16" }
    },
    "breakdown": [
      { "date": "2026-03-16", "model": "qwen2.5:7b", "tokens": 50000, "requests": 120, "cost": 0 },
      { "date": "2026-03-16", "model": "gpt-4o-mini", "tokens": 12000, "requests": 30, "cost": 0.18 }
    ]
  }
}
```

---

### 2.6 Health Check

#### `GET /api/health/models`
Check health of all providers and databases.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "providers": {
      "ollama": { "status": "healthy", "latencyMs": 12, "models": 4 },
      "openai": { "status": "healthy", "latencyMs": 234 },
      "anthropic": { "status": "unreachable", "error": "API key not configured" }
    },
    "databases": {
      "postgresql": { "status": "healthy", "version": "18.3", "latencyMs": 2 },
      "mongodb": { "status": "healthy", "version": "7.0.12", "latencyMs": 5 }
    }
  }
}
```

---

### 2.7 Conversations (MongoDB)

#### `GET /api/conversations`
List conversations.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv_abc123",
        "title": "Debug TypeScript Error",
        "modelId": "019505a3-...",
        "modelName": "Qwen 2.5 7B",
        "messageCount": 12,
        "createdAt": "2026-03-16T10:00:00Z",
        "lastMessageAt": "2026-03-16T10:30:00Z"
      }
    ]
  }
}
```

#### `GET /api/conversations/:id`
Get full conversation with messages.

---

### 2.8 MCP Server Management

#### `GET /api/mcp/servers`
List all registered MCP servers, grouped by domain.

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `domain` | string | No | Filter by domain: `code`, `web`, `data`, `productivity`, `knowledge`, `devops`, `media`, `custom` |
| `status` | string | No | Filter: `connected`, `disconnected`, `disabled`, `error` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": "019505a3-7c00-7000-8000-000000000010",
        "name": "GitHub",
        "domain": "code",
        "transport": "stdio",
        "command": "npx -y @modelcontextprotocol/server-github",
        "enabled": true,
        "status": "connected",
        "toolCount": 24,
        "lastHealthCheck": "2026-03-16T12:00:00Z",
        "createdAt": "2026-03-16T10:00:00Z"
      }
    ],
    "byDomain": {
      "code": 2,
      "web": 1,
      "data": 1,
      "productivity": 0,
      "knowledge": 1,
      "devops": 0,
      "media": 0,
      "custom": 0
    }
  }
}
```

---

#### `POST /api/mcp/servers`
Register a new MCP server.

**Request Body:**
```json
{
  "name": "GitHub",
  "domain": "code",
  "transport": "stdio",
  "command": "npx -y @modelcontextprotocol/server-github",
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx..." },
  "enabled": true,
  "autoConnect": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Display name (unique) |
| `domain` | enum | Yes | One of 8 domains |
| `transport` | enum | Yes | `stdio`, `sse`, `streamable-http` |
| `command` | string | Conditional | Required for stdio transport |
| `url` | string | Conditional | Required for sse/http transport |
| `env` | object | No | Environment variables (encrypted in PG18) |
| `enabled` | boolean | No | Default: `true` |
| `autoConnect` | boolean | No | Default: `true` |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "019505a3-...",
    "name": "GitHub",
    "domain": "code",
    "status": "connecting",
    "message": "MCP server registered. Connecting..."
  }
}
```

---

#### `POST /api/mcp/servers/preset`
Register MCP server from built-in presets.

**Request Body:**
```json
{
  "presetName": "GitHub",
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx..." }
}
```

**Response 201:** Same as POST /api/mcp/servers.

---

#### `PUT /api/mcp/servers/:id`
Update MCP server config.

---

#### `DELETE /api/mcp/servers/:id`
Remove MCP server and its cached tools.

---

#### `POST /api/mcp/servers/:id/toggle`
Enable or disable MCP server.

**Request Body:**
```json
{ "enabled": true }
```

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "...", "enabled": true, "status": "connecting" }
}
```

---

#### `GET /api/mcp/servers/:id/tools`
List tools discovered from a specific MCP server.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "create_issue",
        "bridgedName": "mcp_github_create_issue",
        "description": "Create a new GitHub issue",
        "inputSchema": { "type": "object", "properties": { "title": {}, "body": {} } }
      }
    ],
    "serverId": "019505a3-...",
    "serverName": "GitHub",
    "totalTools": 24
  }
}
```

---

#### `GET /api/mcp/servers/:id/health`
Health check a single MCP server.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "latencyMs": 45,
    "uptime": 3600,
    "lastError": null
  }
}
```

---

#### `GET /api/mcp/presets`
List available built-in MCP server presets.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "presets": [
      { "name": "GitHub", "domain": "code", "transport": "stdio", "requiredEnv": ["GITHUB_PERSONAL_ACCESS_TOKEN"] },
      { "name": "Chrome DevTools", "domain": "web", "transport": "stdio", "requiredEnv": [] },
      { "name": "PostgreSQL", "domain": "data", "transport": "stdio", "requiredEnv": ["POSTGRES_CONNECTION_STRING"] },
      { "name": "Brave Search", "domain": "knowledge", "transport": "stdio", "requiredEnv": ["BRAVE_API_KEY"] }
    ]
  }
}
```

---

### 2.9 Knowledge Base / RAG

#### `GET /api/knowledge/collections`
List all knowledge collections.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "id": "coll_abc123",
        "name": "xClaw Documentation",
        "description": "Official xClaw docs and guides",
        "documentCount": 15,
        "chunkCount": 342,
        "totalSize": "2.4 MB",
        "embeddingModel": "nomic-embed-text",
        "chunkConfig": { "maxTokens": 512, "overlap": 50, "strategy": "recursive" },
        "createdAt": "2026-03-16T10:00:00Z",
        "updatedAt": "2026-03-16T14:00:00Z"
      }
    ]
  }
}
```

---

#### `POST /api/knowledge/collections`
Create a knowledge collection.

**Request Body:**
```json
{
  "name": "xClaw Documentation",
  "description": "Official xClaw docs and guides",
  "chunkConfig": {
    "maxTokens": 512,
    "overlap": 50,
    "strategy": "recursive"
  },
  "embeddingModel": "nomic-embed-text"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Collection name (unique) |
| `description` | string | No | Description |
| `chunkConfig` | object | No | Chunking settings (defaults applied) |
| `embeddingModel` | string | No | Default: `nomic-embed-text` (Ollama) |

---

#### `DELETE /api/knowledge/collections/:id`
Delete collection with all documents and chunks.

---

#### `POST /api/knowledge/collections/:collectionId/documents`
Upload document to a collection. Triggers ingestion pipeline (parse → chunk → embed → store).

**Request:** `multipart/form-data` or JSON body.

```json
{
  "source": "file",
  "name": "README.md",
  "content": "# xClaw\n\nxClaw is an AI Agent platform...",
  "mimeType": "text/markdown"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | enum | Yes | `file`, `text`, `url` |
| `name` | string | Yes | Document name |
| `content` | string | Conditional | Required for `file`/`text` source |
| `url` | string | Conditional | Required for `url` source (will crawl) |
| `mimeType` | string | No | Auto-detected if not provided |

**Response 202 (Accepted — ingestion is async):**
```json
{
  "success": true,
  "data": {
    "documentId": "doc_xyz789",
    "collectionId": "coll_abc123",
    "status": "processing",
    "message": "Document queued for ingestion. Subscribe to rag:embedding:progress for updates."
  }
}
```

---

#### `GET /api/knowledge/collections/:collectionId/documents`
List documents in collection.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_xyz789",
        "name": "README.md",
        "source": "file",
        "mimeType": "text/markdown",
        "size": 4096,
        "chunkCount": 8,
        "status": "ready",
        "ingestedAt": "2026-03-16T10:01:30Z"
      }
    ]
  }
}
```

---

#### `DELETE /api/knowledge/collections/:collectionId/documents/:docId`
Delete document and its chunks from collection.

---

#### `GET /api/knowledge/collections/:collectionId/documents/:docId/chunks`
View chunks of a document (for debugging / review).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "chunks": [
      {
        "id": "chunk_001",
        "index": 0,
        "content": "# xClaw\n\nxClaw is an AI Agent platform that...",
        "tokenCount": 487,
        "hasEmbedding": true
      }
    ],
    "total": 8
  }
}
```

---

#### `POST /api/knowledge/search`
Semantic search across knowledge base.

**Request Body:**
```json
{
  "query": "How does xClaw handle tool calling?",
  "collectionIds": ["coll_abc123"],
  "topK": 5,
  "scoreThreshold": 0.7
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Natural language search query |
| `collectionIds` | string[] | No | Scope to specific collections (empty = all) |
| `topK` | number | No | Max results (default: 5, max: 20) |
| `scoreThreshold` | number | No | Min cosine similarity (default: 0.7) |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "chunkId": "chunk_042",
        "documentId": "doc_xyz789",
        "documentName": "README.md",
        "collectionId": "coll_abc123",
        "collectionName": "xClaw Documentation",
        "content": "xClaw uses tool calling via SkillContext.toolRegistry...",
        "score": 0.89,
        "tokenCount": 312
      }
    ],
    "query": "How does xClaw handle tool calling?",
    "embeddingModel": "nomic-embed-text",
    "searchLatencyMs": 45
  }
}
```

---

#### `GET /api/knowledge/stats`
Knowledge base statistics overview.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "totalCollections": 3,
    "totalDocuments": 42,
    "totalChunks": 1580,
    "totalTokens": 812000,
    "embeddingModel": "nomic-embed-text",
    "embeddingDimensions": 768,
    "storageSize": "24.5 MB",
    "vectorIndexStatus": "ready"
  }
}
```

---

## 3. WebSocket Events

### 3.1 Server → Client Events

| Event Type | Payload | Description |
|---|---|---|
| `skill:event` | `{ skill, event, payload }` | Generic skill event |
| `model:switched` | `{ from, to, scope }` | Active model changed |
| `model:health:changed` | `{ provider, status }` | Provider health update |
| `ollama:pull:progress` | `{ name, percent, downloadedMB, totalMB }` | Pull progress |
| `ollama:pull:complete` | `{ name, profileId, size }` | Pull complete |
| `ollama:pull:error` | `{ name, error }` | Pull failed |
| `benchmark:progress` | `{ modelId, test, status }` | Benchmark test progress |
| `benchmark:complete` | `{ modelId, results }` | Benchmark finished |
| `usage:update` | `{ modelId, tokens, cost }` | Real-time usage update |
| `mcp:server:connected` | `{ serverId, name, domain, toolCount }` | MCP server connected |
| `mcp:server:disconnected` | `{ serverId, reason }` | MCP server lost connection |
| `mcp:server:error` | `{ serverId, error }` | MCP server error |
| `mcp:tool:invoked` | `{ serverId, toolName, success, latencyMs }` | MCP tool called |
| `rag:document:processing` | `{ documentId, collectionId, status }` | Document ingestion started |
| `rag:embedding:progress` | `{ documentId, chunksProcessed, total, percent }` | Embedding generation progress |
| `rag:document:ready` | `{ documentId, collectionId, chunkCount }` | Document fully ingested |
| `rag:document:error` | `{ documentId, error }` | Ingestion failed |
| `rag:search:complete` | `{ query, resultCount, latencyMs }` | RAG search result (for analytics) |

### 3.2 Client → Server Messages

```json
{
  "type": "skill:call",
  "skill": "model-management",
  "tool": "model_list",
  "params": { "provider": "ollama" },
  "requestId": "req-123"
}
```

---

## 4. Error Codes

| Code | HTTP | Description |
|---|---|---|
| `MODEL_NOT_FOUND` | 404 | Model profile ID does not exist |
| `MODEL_IS_ACTIVE` | 409 | Cannot delete active/default model |
| `MODEL_NAME_EXISTS` | 409 | Model name already taken |
| `PROVIDER_INVALID` | 400 | Unknown provider type |
| `PROVIDER_UNREACHABLE` | 503 | Cannot connect to provider |
| `OLLAMA_NOT_RUNNING` | 503 | Ollama service not available |
| `OLLAMA_MODEL_NOT_FOUND` | 404 | Model not in Ollama registry |
| `DISK_SPACE_LOW` | 507 | Insufficient disk for pull |
| `PG_CONNECTION_ERROR` | 503 | PostgreSQL 18 unreachable |
| `MONGO_CONNECTION_ERROR` | 503 | MongoDB unreachable |
| `BENCHMARK_TIMEOUT` | 408 | Benchmark exceeded timeout |
| `INVALID_API_KEY` | 401 | API key is invalid or expired |
| `ENCRYPTION_KEY_MISSING` | 500 | Server encryption key not set |
| `MCP_SERVER_NOT_FOUND` | 404 | MCP server ID does not exist |
| `MCP_SERVER_NAME_EXISTS` | 409 | MCP server name already taken |
| `MCP_CONNECTION_FAILED` | 503 | Cannot connect to MCP server |
| `MCP_TOOL_NOT_FOUND` | 404 | MCP tool does not exist on server |
| `MCP_TRANSPORT_INVALID` | 400 | Invalid transport type or missing command/url |
| `MCP_SERVER_DISABLED` | 409 | MCP server is disabled, enable first |
| `KB_COLLECTION_NOT_FOUND` | 404 | Knowledge collection does not exist |
| `KB_COLLECTION_NAME_EXISTS` | 409 | Collection name already taken |
| `KB_DOCUMENT_NOT_FOUND` | 404 | Document does not exist in collection |
| `KB_DOCUMENT_TOO_LARGE` | 413 | Document exceeds max size (default 10MB) |
| `KB_UNSUPPORTED_FORMAT` | 415 | File format not supported for parsing |
| `KB_EMBEDDING_FAILED` | 500 | Embedding model unavailable or failed |
| `KB_SEARCH_FAILED` | 500 | Vector search error |
| `KB_INGESTION_FAILED` | 500 | Document parse/chunk/embed pipeline failed |

---

## 5. Skill Tool ↔ REST API Mapping

| Skill Tool | REST Endpoint | Method |
|---|---|---|
| `model_list` | `/api/models` | GET |
| `model_create` | `/api/models` | POST |
| `model_update` | `/api/models/:id` | PUT |
| `model_delete` | `/api/models/:id` | DELETE |
| `model_switch` | `/api/models/switch` | POST |
| `model_get_active` | `/api/models/active` | GET |
| `model_benchmark` | `/api/models/:id/benchmark` | POST |
| `model_test_connection` | `/api/models/:id/test` | POST |
| `ollama_list` | `/api/ollama/models` | GET |
| `ollama_pull` | `/api/ollama/pull` | POST |
| `ollama_remove` | `/api/ollama/models/:name` | DELETE |
| `provider_health_check` | `/api/health/models` | GET |
| `mcp_register` | `/api/mcp/servers` | POST |
| `mcp_list` | `/api/mcp/servers` | GET |
| `mcp_toggle` | `/api/mcp/servers/:id/toggle` | POST |
| `mcp_health` | `/api/mcp/servers/:id/health` | GET |
| `kb_create_collection` | `/api/knowledge/collections` | POST |
| `kb_add_document` | `/api/knowledge/collections/:id/documents` | POST |
| `kb_search` | `/api/knowledge/search` | POST |
| `kb_list_collections` | `/api/knowledge/collections` | GET |
| `kb_delete_collection` | `/api/knowledge/collections/:id` | DELETE |
| `kb_delete_document` | `/api/knowledge/collections/:cid/documents/:did` | DELETE |

REST endpoints act as thin wrappers that call the same Service layer as the Skill tools.
