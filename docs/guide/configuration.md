# Configuration

xClaw is configured via environment variables in the `.env` file.

## LLM Provider

```ini
# Provider: openai | anthropic | ollama
LLM_PROVIDER=openai

# Model to use
LLM_MODEL=gpt-4o

# Max tokens per response
LLM_MAX_TOKENS=4096

# Temperature (0.0 = deterministic, 1.0 = creative)
LLM_TEMPERATURE=0.7
```

## Provider API Keys

### OpenAI

```ini
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
LLM_MODEL=gpt-4o          # gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
```

### Anthropic Claude

```ini
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-20250514  # claude-sonnet-4-20250514, claude-3-haiku, claude-3-opus
```

### Ollama (Local)

```ini
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
LLM_MODEL=llama3.1         # Any model installed in Ollama
```

::: tip
Ollama uses an OpenAI-compatible API, so it works through the OpenAI adapter internally.
:::

## Server Configuration

```ini
# Server port
PORT=18789

# CORS origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Data directory for persistent storage
DATA_DIR=./data
```

## Agent Settings

```ini
# Agent persona / system prompt
AGENT_PERSONA=You are xClaw, a helpful AI assistant.

# Max tool call iterations per chat turn
MAX_TOOL_ITERATIONS=10

# Tool execution timeout (ms)
TOOL_TIMEOUT=30000
```

## Memory Configuration

```ini
# Enable long-term memory
MEMORY_ENABLED=true

# Max conversation history messages
MAX_HISTORY=20
```

## All Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `18789` | Server port |
| `LLM_PROVIDER` | `openai` | LLM provider |
| `LLM_MODEL` | `gpt-4o` | Model name |
| `LLM_MAX_TOKENS` | `4096` | Max response tokens |
| `LLM_TEMPERATURE` | `0.7` | Response temperature |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `DATA_DIR` | `./data` | Persistent data directory |
| `AGENT_PERSONA` | — | Custom system prompt |
| `MAX_TOOL_ITERATIONS` | `10` | Max tool loops |
| `TOOL_TIMEOUT` | `30000` | Tool timeout (ms) |
| `MEMORY_ENABLED` | `true` | Enable memory system |
| `MAX_HISTORY` | `20` | Chat history length |
