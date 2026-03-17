# Getting Started

Get xClaw running locally in under 5 minutes.

## Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org/))
- **npm** 10+ (included with Node.js)
- An LLM API key (OpenAI, Anthropic, or local Ollama)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/tdduydev/xClaw.git
cd xClaw
```

### 2. Install Dependencies

```bash
npm install
```

This installs all packages in the monorepo workspace.

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your LLM API key:

```ini
# Choose your LLM provider
LLM_PROVIDER=openai          # openai | anthropic | ollama
OPENAI_API_KEY=sk-...        # Required for OpenAI
ANTHROPIC_API_KEY=sk-ant-... # Required for Anthropic
OLLAMA_URL=http://localhost:11434  # Required for Ollama
```

### 4. Start Development Server

```bash
npm run dev
```

This starts both the backend server and frontend:

| Service | URL |
|---------|-----|
| **Web UI** | http://localhost:3000 |
| **API Server** | http://localhost:18789 |
| **WebSocket** | ws://localhost:18789/ws |

### 5. Start Chatting

Open http://localhost:3000 in your browser. The **Programming & DevOps** agent is active by default with 11 tools including shell execution, file management, and Git operations.

## What's Next?

- [Installation Options](/guide/installation) — Docker, production builds
- [Configuration](/guide/configuration) — LLM providers, model settings
- [Skill System](/skills/overview) — Browse and install AI agents
- [Architecture](/architecture/overview) — How xClaw works under the hood
