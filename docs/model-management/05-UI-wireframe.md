# UI Wireframe & Design
## AutoX Model Management — Web Interface
**Version:** 3.0.0  
**Date:** 2026-03-16

---

## 1. Navigation Structure

```
AutoX Web UI (React 19 + Vite 6 + Tailwind)
├── 🏠 Dashboard (existing)
├── 💬 Chat (existing)
├── 🤖 Models ← NEW TAB
│   ├── Model List (default view)
│   ├── Model Detail / Edit
│   ├── Ollama Registry
│   ├── Benchmarks
│   └── Usage Statistics
├── � MCP Servers ← NEW TAB
│   ├── Server List (grouped by domain)
│   ├── Presets Browser
│   ├── Server Detail / Tools
│   └── Health Dashboard
├── 📚 Knowledge Base ← NEW TAB
│   ├── Collections (default view)
│   ├── Collection Detail / Documents
│   ├── Document Chunks Viewer
│   ├── Semantic Search
│   └── RAG Settings
├── �🛠️ Skills (existing)
└── ⚙️ Settings (existing)
```

---

## 2. Model List View (Main)

```
┌──────────────────────────────────────────────────────────────────────┐
│  🤖 Models                                    [+ Add Model] [🔄 Sync] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Filter: [All Providers ▼] [All Status ▼]    Search: [_____________] │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ ⭐ Qwen 2.5 7B                                    ● Available  │ │
│  │    Provider: ollama │ Model: qwen2.5:7b │ 4.7 GB              │ │
│  │    Speed: 10.0 tok/s │ Tool Calling: ✅ │ DEFAULT              │ │
│  │    Tokens used: 150K │ Cost: $0.00                             │ │
│  │                                                                 │ │
│  │    [Switch To] [Benchmark] [Edit] [···]                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │   Qwen 2.5 1.5B                                   ● Available  │ │
│  │    Provider: ollama │ Model: qwen2.5:1.5b │ 986 MB            │ │
│  │    Speed: 33.6 tok/s │ Tool Calling: ✅                        │ │
│  │    Tokens used: 80K │ Cost: $0.00                              │ │
│  │                                                                 │ │
│  │    [Switch To] [Benchmark] [Edit] [···]                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │   GPT-4o Mini                                      ● Available  │ │
│  │    Provider: openai │ Model: gpt-4o-mini │ API Key: ****       │ │
│  │    Speed: N/A │ Tool Calling: ✅ │ Vision: ✅                   │ │
│  │    Tokens used: 12K │ Cost: $0.18                              │ │
│  │                                                                 │ │
│  │    [Switch To] [Benchmark] [Edit] [···]                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │   Gemma 2 2B                                     ⚠ Unavailable  │ │
│  │    Provider: ollama │ Model: gemma2:2b │ 1.6 GB               │ │
│  │    Speed: 19.4 tok/s │ Tool Calling: ❌                        │ │
│  │    Status: No tool calling support                              │ │
│  │                                                                 │ │
│  │    [Switch To] [Benchmark] [Edit] [···]                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ─── Health Status ──────────────────────────────────────────────── │
│  PostgreSQL 18.3: ● Healthy (2ms) │ MongoDB 7.0: ● Healthy (5ms)  │
│  Ollama: ● Running (4 models) │ OpenAI: ● Connected                │
│  Anthropic: ○ Not configured                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Add/Edit Model Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  Add New Model                                              [✕]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Provider:  (●) Ollama  ( ) OpenAI  ( ) Anthropic  ( ) Custom   │
│                                                                   │
│  ┌─── Basic Info ──────────────────────────────────────────────┐ │
│  │ Display Name:  [_________________________________]          │ │
│  │ Model ID:      [qwen2.5:3b_________________________] 🔍    │ │
│  │                (Auto-suggest from Ollama registry)          │ │
│  │ Base URL:      [http://localhost:11434______________]       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── Parameters ──────────────────────────────────────────────┐ │
│  │ Temperature:   [0.7___] ─────────●──── 0.0  ──  2.0       │ │
│  │ Max Tokens:    [4096__]                                     │ │
│  │ Top P:         [1.0___] ──────────────●  0.0  ──  1.0     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── API Key (Cloud Providers Only) ─────────────────────────┐ │
│  │ API Key:       [sk-abc123...____________________] 🔒       │ │
│  │                (Encrypted with AES-256-GCM in PostgreSQL)   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── Capabilities ───────────────────────────────────────────┐ │
│  │ [✅] Tool Calling   [☐] Vision   [☐] Embedding            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [Test Connection]              [Cancel]  [💾 Save to PostgreSQL] │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Ollama Registry View

```
┌──────────────────────────────────────────────────────────────────────┐
│  Ollama Registry                                         [🔄 Refresh] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ─── Local Models (4) ──────────────────────────────────────────── │
│                                                                       │
│  │ Model           │ Size    │ Family │ Quantization │ Registered │ │
│  ├─────────────────┼─────────┼────────┼──────────────┼────────────┤ │
│  │ qwen2.5:7b      │ 4.7 GB  │ qwen2  │ Q4_K_M       │ ✅ Yes     │ │
│  │ qwen2.5:1.5b    │ 986 MB  │ qwen2  │ Q4_K_M       │ ✅ Yes     │ │
│  │ gemma2:2b        │ 1.6 GB  │ gemma2 │ Q4_0         │ ✅ Yes     │ │
│  │ phi3:mini        │ 2.2 GB  │ phi3   │ Q4_K_M       │ ✅ Yes     │ │
│                                                                       │
│  ─── Pull New Model ────────────────────────────────────────────── │
│                                                                       │
│  Model name: [qwen2.5:3b________________________] [📥 Pull]        │
│                                                                       │
│  Popular:  [qwen2.5:3b] [llama3.2:3b] [codellama:7b] [mistral:7b] │
│                                                                       │
│  ─── Active Pull ───────────────────────────────────────────────── │
│                                                                       │
│  │ 📥 Pulling qwen2.5:3b ...                                      │ │
│  │ ████████████████░░░░░░░░░░  65%  (1.2 GB / 1.9 GB)            │ │
│  │ Speed: 45 MB/s │ ETA: 16s                                      │ │
│  │                                                   [Cancel Pull] │ │
│                                                                       │
│  Disk: 468 GB total │ 12 GB used by models │ 440 GB free           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Benchmark View

```
┌──────────────────────────────────────────────────────────────────────┐
│  Benchmarks                                   [Run All] [Compare]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Select models: [✅ Qwen 7B] [✅ Qwen 1.5B] [☐ Gemma 2B] [☐ Phi3] │
│  Tests: [✅ Speed] [✅ Code] [✅ Tool Calling] [✅ Vietnamese]        │
│                                                                       │
│  ─── Results ───────────────────────────────────────────────────── │
│                                                                       │
│  │ Model          │ Speed    │ Code │ Tools │ Vietnamese │ Overall │ │
│  ├────────────────┼──────────┼──────┼───────┼────────────┼─────────┤ │
│  │ qwen2.5:7b     │ 10.0 t/s │  8.0 │  ✅   │    8.5     │  8.2    │ │
│  │ qwen2.5:1.5b   │ 33.6 t/s │  6.5 │  ✅   │    7.0     │  6.8    │ │
│  │ gemma2:2b       │ 19.4 t/s │  5.0 │  ❌   │    4.0     │  4.5    │ │
│  │ phi3:mini       │ 19.6 t/s │  7.0 │  ❌   │    5.5     │  6.0    │ │
│                                                                       │
│  ─── Speed Chart ───────────────────────────────────────────────── │
│                                                                       │
│  qwen2.5:1.5b  ████████████████████████████████████  33.6 tok/s    │
│  phi3:mini      ███████████████████░░░░░░░░░░░░░░░░  19.6 tok/s    │
│  gemma2:2b      ██████████████████░░░░░░░░░░░░░░░░░  19.4 tok/s    │
│  qwen2.5:7b     ██████████░░░░░░░░░░░░░░░░░░░░░░░░░  10.0 tok/s    │
│                                                                       │
│  Hardware: i5-13400 (16 threads) │ 32 GB RAM │ No GPU               │
│  Data stored in: PostgreSQL 18 (benchmark_results table)             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Usage Statistics View

```
┌──────────────────────────────────────────────────────────────────────┐
│  Usage Statistics                  Period: [Last 30 Days ▼] [Export] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  1.5M    │  │  4,230   │  │  $2.45   │  │  850ms   │            │
│  │  Tokens  │  │ Requests │  │ Est.Cost │  │ Avg Lat  │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                       │
│  ─── Daily Token Usage (Line Chart) ─────────────────────────────  │
│                                                                       │
│   70K│      ╱╲                                                       │
│   60K│     ╱  ╲    ╱╲                                                │
│   50K│    ╱    ╲  ╱  ╲   ╱╲                                         │
│   40K│   ╱      ╲╱    ╲ ╱  ╲                                        │
│   30K│  ╱              ╲    ╲╱╲                                     │
│   20K│ ╱                        ╲                                    │
│   10K│╱                          ╲                                   │
│      └──────────────────────────────                                 │
│       Mar 1        Mar 8        Mar 16                               │
│                                                                       │
│       ── qwen2.5:7b  ·· gpt-4o-mini  -- qwen2.5:1.5b              │
│                                                                       │
│  ─── Model Breakdown (Pie Chart) ────────────────────────────────  │
│                                                                       │
│  │ Model          │ Tokens   │ Requests │ Cost    │ % Total │       │
│  ├────────────────┼──────────┼──────────┼─────────┼─────────┤       │
│  │ qwen2.5:7b     │ 1.2M     │ 3,500    │ $0.00   │ 80%     │       │
│  │ gpt-4o-mini    │ 200K     │ 500      │ $2.30   │ 13%     │       │
│  │ qwen2.5:1.5b   │ 100K     │ 230      │ $0.00   │ 7%      │       │
│                                                                       │
│  Data source: PostgreSQL 18 (usage_records + virtual cost_estimate)  │
│  💡 cost_estimate is a PG18 virtual generated column — computed,     │
│     not stored.                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Chat Integration — Model Selector

```
┌──────────────────────────────────────────────────────────────────────┐
│  💬 Chat                                                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Model: [🤖 Qwen 2.5 7B (ollama) ▼]    ← Quick switch dropdown     │
│         ┌─────────────────────────────────┐                          │
│         │ ⭐ Qwen 2.5 7B     (default)   │                          │
│         │    Qwen 2.5 1.5B   (fast)      │                          │
│         │    GPT-4o Mini     (cloud)     │                          │
│         │    ──────────────────────       │                          │
│         │    ⚙ Manage Models              │                          │
│         └─────────────────────────────────┘                          │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  [User] Fix this TypeScript error                             │  │
│  │                                                                │  │
│  │  [Qwen 2.5 7B] I see the issue. Let me read the file...     │  │
│  │  🔧 Using tool: file_read("src/index.ts")                    │  │
│  │  ...                                                          │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Conversation stored in: MongoDB (conversations collection)          │
│  Token usage logged to: PostgreSQL 18 (usage_records table)          │
│                                                                       │
│  [Type a message...___________________________________] [Send]       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. MCP Server Management View

### 8.1 MCP Server List (Grouped by Domain)

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔌 MCP Servers                          [+ Add Server] [📦 Presets] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Filter: [All Domains ▼] [All Status ▼]     Search: [____________]  │
│                                                                       │
│  Summary: 5 servers │ 3 connected │ 78 tools available               │
│                                                                       │
│  ─── 💻 Code & Dev (2 servers) ─────────────────────────────────── │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 🟢 GitHub                               Transport: stdio       │ │
│  │    npx -y @modelcontextprotocol/server-github                  │ │
│  │    Tools: 24 │ Uptime: 2h 15m │ Last health: 12s ago          │ │
│  │                                                                 │ │
│  │    [View Tools] [Health Check] [⏸ Disable] [···]              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 🟢 File System                          Transport: stdio       │ │
│  │    npx -y @anthropic/mcp-filesystem                            │ │
│  │    Tools: 8 │ Uptime: 2h 15m                                   │ │
│  │                                                                 │ │
│  │    [View Tools] [Health Check] [⏸ Disable] [···]              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ─── 🌐 Web & Browser (1 server) ──────────────────────────────── │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 🟢 Chrome DevTools                      Transport: stdio       │ │
│  │    npx -y @anthropic/mcp-chrome-devtools                       │ │
│  │    Tools: 31 │ Uptime: 1h 30m                                  │ │
│  │                                                                 │ │
│  │    [View Tools] [Health Check] [⏸ Disable] [···]              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ─── 🔍 Knowledge & AI (1 server) ─────────────────────────────── │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 Brave Search                         Transport: stdio       │ │
│  │    Error: BRAVE_API_KEY not set                                 │ │
│  │    Tools: 0 │ Last error: 5m ago                                │ │
│  │                                                                 │ │
│  │    [Configure] [Retry] [🗑 Remove]                             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ─── 📊 Data & Database (1 server) ────────────────────────────── │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ ⚪ PostgreSQL MCP                        Transport: stdio       │ │
│  │    Disabled by user                                             │ │
│  │                                                                 │ │
│  │    [▶ Enable] [Edit] [🗑 Remove]                               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ─── 🎯 Productivity (0 servers) ──────────────────────────────── │
│  ─── 🔧 DevOps (0 servers) ────────────────────────────────────── │
│  ─── 🎨 Media (0 servers) ─────────────────────────────────────── │
│  ─── ⚙️ Custom (0 servers) ────────────────────────────────────── │
│                                                                       │
│  Server configs stored in: PostgreSQL 18 (mcp_servers table)         │
│  Tool cache stored in: PostgreSQL 18 (mcp_tools table)               │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 MCP Presets Browser Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  📦 MCP Presets — Quick Setup                               [✕]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Choose a preset to quickly register an MCP server:              │
│                                                                   │
│  ┌─── 💻 Code & Dev ──────────────────────────────────────────┐ │
│  │ [+ GitHub]     Requires: GITHUB_TOKEN                       │ │
│  │ [+ GitLab]     Requires: GITLAB_TOKEN                       │ │
│  │ [✅ File System] Already registered                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── 🌐 Web & Browser ───────────────────────────────────────┐ │
│  │ [✅ Chrome DevTools] Already registered                      │ │
│  │ [+ Puppeteer]  No env required                              │ │
│  │ [+ Playwright] No env required                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── 📊 Data & Database ─────────────────────────────────────┐ │
│  │ [✅ PostgreSQL] Already registered                           │ │
│  │ [+ MongoDB]    Requires: MONGO_URL                          │ │
│  │ [+ SQLite]     No env required                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── 🔍 Knowledge & AI ──────────────────────────────────────┐ │
│  │ [+ Brave Search] Requires: BRAVE_API_KEY                    │ │
│  │ [+ Web Search]   No env required                            │ │
│  │ [+ Wikipedia]    No env required                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│                                             [Cancel] [Done]      │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 MCP Add Server / Configure Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  Add MCP Server                                             [✕]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─── Basic Info ──────────────────────────────────────────────┐ │
│  │ Name:     [GitHub_________________________________]         │ │
│  │ Domain:   [💻 Code & Dev ▼]                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── Transport ───────────────────────────────────────────────┐ │
│  │ Type: (●) stdio  ( ) SSE  ( ) Streamable HTTP              │ │
│  │                                                              │ │
│  │ Command: [npx -y @modelcontextprotocol/server-github__]     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── Environment Variables (encrypted) ──────────────────────┐ │
│  │ GITHUB_PERSONAL_ACCESS_TOKEN: [ghp_xxx...________] 🔒      │ │
│  │                                                              │ │
│  │ [+ Add Variable]                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─── Options ─────────────────────────────────────────────────┐ │
│  │ [✅] Enabled   [✅] Auto-connect on startup                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [Test Connection]                 [Cancel]  [💾 Save]           │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4 MCP Server Tools Viewer

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔌 GitHub — 24 Tools                   [🔄 Refresh] [⏸ Disable]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Status: 🟢 Connected │ Uptime: 2h 15m │ Latency: 45ms              │
│  Transport: stdio │ Domain: Code & Dev                                │
│                                                                       │
│  Search tools: [____________________________________] 🔍             │
│                                                                       │
│  │ Bridged Name                    │ Description              │ Used │ │
│  ├─────────────────────────────────┼──────────────────────────┼──────┤ │
│  │ mcp_github_create_issue         │ Create a GitHub issue    │  42  │ │
│  │ mcp_github_search_issues        │ Search GitHub issues     │  38  │ │
│  │ mcp_github_create_pull_request  │ Create a pull request    │  15  │ │
│  │ mcp_github_get_file_contents    │ Get file from repo       │  12  │ │
│  │ mcp_github_list_commits         │ List commits on branch   │   8  │ │
│  │ ...                             │ ...                      │  ... │ │
│                                                                       │
│  💡 Agent can call these tools directly via tool calling.            │
│     Example: "Create a GitHub issue about the login bug"             │
│                                                                       │
│  Tool data cached in: PostgreSQL 18 (mcp_tools table)                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Knowledge Base Management View

### 9.1 Collections Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  📚 Knowledge Base                      [+ New Collection] [⚙ RAG]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Overview: 3 collections │ 42 documents │ 1,580 chunks │ 24.5 MB    │
│  Embedding: nomic-embed-text (768 dim) via Ollama                    │
│  Vector Index: ● Ready                                                │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 📁 AutoX Documentation                                         │ │
│  │    15 documents │ 342 chunks │ 2.4 MB                          │ │
│  │    Embedding: nomic-embed-text │ Chunk: 512 tokens, recursive  │ │
│  │    Tags: documentation, autox                                   │ │
│  │    Updated: 2 hours ago                                         │ │
│  │                                                                 │ │
│  │    [Open] [📤 Add Document] [🔍 Search] [···]                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 📁 TypeScript Best Practices                                    │ │
│  │    12 documents │ 580 chunks │ 8.1 MB                          │ │
│  │    Embedding: nomic-embed-text │ Chunk: 512 tokens, recursive  │ │
│  │    Tags: typescript, coding                                     │ │
│  │    Updated: 1 day ago                                           │ │
│  │                                                                 │ │
│  │    [Open] [📤 Add Document] [🔍 Search] [···]                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 📁 Company Wiki                                                 │ │
│  │    15 documents │ 658 chunks │ 14.0 MB                         │ │
│  │    Embedding: nomic-embed-text │ Chunk: 512 tokens, paragraph  │ │
│  │    Tags: company, internal                                      │ │
│  │    Updated: 3 days ago                                          │ │
│  │                                                                 │ │
│  │    [Open] [📤 Add Document] [🔍 Search] [···]                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Data stored in: MongoDB (knowledge_collections, knowledge_documents,│
│  knowledge_chunks) │ Config in: PostgreSQL 18 (rag_configs)          │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.2 Collection Detail — Document List

```
┌──────────────────────────────────────────────────────────────────────┐
│  📁 AutoX Documentation                  [📤 Add Document] [⚙ Edit] │
│  ← Back to Collections                                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  15 documents │ 342 chunks │ 2.4 MB │ Embedding: nomic-embed-text   │
│                                                                       │
│  │ Name              │ Source │ Size   │ Chunks │ Status  │ Action  │ │
│  ├───────────────────┼────────┼────────┼────────┼─────────┼─────────┤ │
│  │ README.md         │ file   │ 4 KB   │    8   │ ✅ Ready│ [👁][🗑]│ │
│  │ API-Guide.pdf     │ file   │ 250 KB │   52   │ ✅ Ready│ [👁][🗑]│ │
│  │ Architecture.md   │ file   │ 12 KB  │   24   │ ✅ Ready│ [👁][🗑]│ │
│  │ autox.dev/docs    │ url    │ 80 KB  │   45   │ ✅ Ready│ [👁][🗑]│ │
│  │ CHANGELOG.md      │ file   │ 8 KB   │   16   │ ✅ Ready│ [👁][🗑]│ │
│  │ Setup-Guide.md    │ file   │ 6 KB   │   12   │ 🔄 Proc│ ──────  │ │
│  │ ...               │        │        │        │         │         │ │
│                                                                       │
│  ─── Processing ──────────────────────────────────────────────────  │
│  │ 🔄 Setup-Guide.md — Embedding chunks... 8/12 (67%)            │ │
│  │ ████████████████████████░░░░░░░░░░░░                           │ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.3 Add Document Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  📤 Add Document to "AutoX Documentation"                   [✕]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Source: (●) File Upload  ( ) Paste Text  ( ) URL                │
│                                                                   │
│  ┌─── File Upload ─────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────┐             │ │
│  │  │  📎 Drag & drop files here                 │             │ │
│  │  │     or click to browse                     │             │ │
│  │  │                                            │             │ │
│  │  │  Supported: PDF, MD, TXT, DOCX, HTML      │             │ │
│  │  │  Max size: 10 MB per file                  │             │ │
│  │  └────────────────────────────────────────────┘             │ │
│  │                                                              │ │
│  │  Selected:                                                   │ │
│  │  ✅ Setup-Guide.md (6 KB)                                    │ │
│  │  ✅ Deployment-Notes.txt (2 KB)                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Pipeline: Parse → Chunk (512 tokens) → Embed → Store            │
│  Embedding model: nomic-embed-text (768 dim)                     │
│                                                                   │
│                              [Cancel]  [📤 Upload & Process]     │
└──────────────────────────────────────────────────────────────────┘
```

### 9.4 Document Chunk Viewer

```
┌──────────────────────────────────────────────────────────────────────┐
│  👁 README.md — 8 Chunks                                    [Close] │
│  Collection: AutoX Documentation                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Original: 4,096 bytes │ Parsed: Markdown → Plain text               │
│  Chunks: 8 │ Strategy: recursive │ Max: 512 tokens │ Overlap: 50    │
│                                                                       │
│  ┌── Chunk 1 / 8 ── 487 tokens ── score: — ─────────────────────┐  │
│  │ # AutoX                                                        │  │
│  │                                                                │  │
│  │ AutoX is an AI Agent platform that enables building,           │  │
│  │ deploying, and managing AI agents with tool calling            │  │
│  │ capabilities. It uses a gateway architecture with...           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌── Chunk 2 / 8 ── 510 tokens ── score: — ─────────────────────┐  │
│  │ ## Installation                                                │  │
│  │                                                                │  │
│  │ 1. Clone the repository: git clone https://...                │  │
│  │ 2. Install dependencies: npm install                          │  │
│  │ 3. Configure environment: cp .env.example .env...             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌── Chunk 3 / 8 ── 498 tokens ── score: — ─────────────────────┐  │
│  │ ## Usage                                                       │  │
│  │ ...                                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  💡 Each chunk has a 768-dim embedding vector stored in MongoDB.     │
│     When you ask a question, chunks with highest cosine similarity   │
│     are injected into the Agent's prompt as context.                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.5 Semantic Search View

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔍 Knowledge Search                                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Search: [How does AutoX handle tool calling?________] [🔍 Search]  │
│                                                                       │
│  Collections: [✅ All] [☐ AutoX Docs only] [☐ TS Best Practices]    │
│  Top K: [5 ▼]  │  Min Score: [0.70___]                               │
│                                                                       │
│  ─── Results (3 found in 45ms) ──────────────────────────────────  │
│                                                                       │
│  ┌── Score: 0.89 ── AutoX Documentation / README.md ─────────────┐  │
│  │ AutoX uses tool calling via SkillContext.toolRegistry. Each     │  │
│  │ skill registers tools with defineSkill(), and the Agent LLM    │  │
│  │ can invoke them through the standard tool_calls mechanism...   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌── Score: 0.82 ── AutoX Documentation / Architecture.md ───────┐  │
│  │ The SkillManager loads skills and their tools into the         │  │
│  │ ToolRegistry. Agent.buildMessages() includes tool definitions  │  │
│  │ in the LLM request. When LLM returns tool_calls, the Agent... │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌── Score: 0.74 ── TS Best Practices / function-patterns.md ────┐  │
│  │ Function calling patterns in TypeScript: define clear          │  │
│  │ interfaces for tool inputs and outputs. Use Zod schemas...    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Model: nomic-embed-text │ Dimensions: 768 │ Similarity: cosine     │
│  These results would be injected into Agent prompt as RAG context.   │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.6 RAG Settings Panel

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚙ RAG Settings                                             [Save]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─── Embedding Model ────────────────────────────────────────────┐ │
│  │ Primary:   (●) nomic-embed-text (Ollama, 768 dim, free)      │ │
│  │            ( ) text-embedding-3-small (OpenAI, 1536 dim, $$)  │ │
│  │                                                                │ │
│  │ Status: ● Model loaded (nomic-embed-text)                     │ │
│  │ Speed: ~500 tokens/sec on CPU (i5-13400)                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─── Default Chunking ──────────────────────────────────────────┐ │
│  │ Strategy:   [Recursive ▼]  (paragraph → line → sentence)     │ │
│  │ Max Tokens: [512______]    tokens per chunk                   │ │
│  │ Overlap:    [50_______]    tokens overlap between chunks      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─── Search Defaults ───────────────────────────────────────────┐ │
│  │ Top K:           [5___]    max results per search             │ │
│  │ Score Threshold: [0.70]    min cosine similarity              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─── Auto-Inject ───────────────────────────────────────────────┐ │
│  │ [✅] Automatically inject RAG context into Agent prompt        │ │
│  │                                                                │ │
│  │ When enabled, every user message triggers a RAG search and    │ │
│  │ top-K matching chunks are added to the system prompt as       │ │
│  │ "Relevant Knowledge" before sending to LLM.                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Config stored in: PostgreSQL 18 (rag_configs table)                 │
│  Analytics: PostgreSQL 18 (rag_query_log table)                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Component Architecture (React)

```
src/components/models/
├── ModelListPage.tsx           # Main models page
├── ModelCard.tsx               # Individual model card
├── ModelFormModal.tsx          # Add/Edit modal
├── ModelSwitcher.tsx           # Quick switch dropdown (in chat)
├── OllamaRegistryPanel.tsx    # Ollama pull/list
├── OllamaPullProgress.tsx     # Pull progress bar (WebSocket)
├── BenchmarkPanel.tsx         # Benchmark runner & results
├── BenchmarkChart.tsx         # Comparison charts
├── UsageStatsPanel.tsx        # Usage statistics
├── UsageChart.tsx             # Token usage charts
├── HealthStatusBar.tsx        # PG + Mongo + Provider health
└── hooks/
    ├── useModels.ts           # Zustand store for models
    ├── useBenchmarks.ts       # Benchmark state
    ├── useUsageStats.ts       # Usage data
    ├── useOllama.ts           # Ollama operations
    └── useModelWebSocket.ts   # WS events subscription

src/components/mcp/
├── MCPServerListPage.tsx      # Main MCP servers page (grouped by domain)
├── MCPServerCard.tsx          # Individual server card
├── MCPPresetsModal.tsx        # Presets browser
├── MCPAddServerModal.tsx      # Add/configure server modal
├── MCPToolsViewer.tsx         # View tools from a server
├── MCPHealthDashboard.tsx     # Health status for all MCP servers
└── hooks/
    ├── useMCPServers.ts       # Zustand store for MCP servers
    ├── useMCPTools.ts         # Tool discovery & cache
    └── useMCPWebSocket.ts     # MCP WS events (connect/disconnect/error)

src/components/knowledge/
├── KnowledgeOverviewPage.tsx  # Collections overview
├── CollectionCard.tsx         # Individual collection card
├── CollectionDetailPage.tsx   # Document list within collection
├── CreateCollectionModal.tsx  # New collection modal
├── AddDocumentModal.tsx       # Upload/paste/URL document modal
├── ChunkViewerPanel.tsx       # View chunks of a document
├── SemanticSearchPage.tsx     # Knowledge search interface
├── RAGSettingsPanel.tsx       # RAG configuration
├── IngestionProgress.tsx      # Document processing progress (WebSocket)
└── hooks/
    ├── useKnowledge.ts        # Zustand store for collections/documents
    ├── useRAGSearch.ts        # Search state & results
    ├── useRAGSettings.ts      # RAG config
    └── useKnowledgeWebSocket.ts # Ingestion progress WS events
```

**State Management:** Zustand 5 stores, same pattern as existing code.

---

## 11. Responsive Design

| Breakpoint | Layout |
|---|---|
| Desktop (>1024px) | Full layout as wireframes above |
| Tablet (768-1024px) | Single column, collapsible panels |
| Mobile (<768px) | Stack layout, model cards simplified, bottom sheet for quick switch |
