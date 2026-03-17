# Software Requirements Specification (SRS)
## xClaw Model Management Skill
**Version:** 3.0.0  
**Date:** 2026-03-16  
**Author:** xClaw Team  
**Status:** Draft  

---

## 1. Introduction

### 1.1 Purpose
Tài liệu này mô tả đầy đủ các yêu cầu phần mềm cho **Model Management Skill** trong hệ thống xClaw AI Agent Platform. Skill này cho phép người dùng quản lý nhiều LLM models (Ollama, OpenAI, Anthropic, Google...) từ một giao diện thống nhất, được thiết kế theo đúng kiến trúc Skill Plugin Pattern của xClaw.

### 1.2 Scope
Model Management Skill bao gồm:
- Quản lý cấu hình nhiều LLM models (CRUD)
- Pull/Download models từ Ollama registry
- Monitor trạng thái và hiệu năng models
- Chuyển đổi model active cho từng session/agent
- Benchmark và so sánh models
- **MCP Server Management** — Quản lý MCP servers theo từng chuyên đề (Code, Web, Data, DevOps, Knowledge...)
- **RAG Pipeline & Knowledge Base** — Upload tài liệu, chunking, embedding, semantic search, inject context vào LLM
- **PostgreSQL 18** — Structured data (model profiles, MCP configs, RAG sources, usage records, benchmarks)
- **MongoDB** — Unstructured data (chat logs, knowledge chunks, embeddings, raw LLM responses, conversation history)
- Theo dõi usage & token consumption

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| LLM | Large Language Model |
| Model Provider | Dịch vụ cung cấp model (Ollama, OpenAI, Anthropic...) |
| Model Profile | Bộ cấu hình đầy đủ cho một model instance |
| Active Model | Model đang được sử dụng cho chat session hiện tại |
| Model Registry | Danh sách models có sẵn từ provider (vd: Ollama library) |
| Benchmark | Đánh giá hiệu năng model (speed, quality, tool calling) |
| Skill | Plugin module trong xClaw với manifest + tools + lifecycle |
| MCP | Model Context Protocol — chuẩn kết nối AI models với external tools/data |
| MCP Server | Process cung cấp tools/resources cho AI qua MCP protocol |
| MCP Domain | Chuyên đề/lĩnh vực chuyên biệt của MCP server (Code, Web, Data...) |
| RAG | Retrieval-Augmented Generation — kỹ thuật inject knowledge vào LLM context |
| Knowledge Base | Tập hợp tài liệu đã được chunk + embed, sẵn sàng cho semantic search |
| Collection | Nhóm tài liệu trong Knowledge Base theo chủ đề |
| Chunk | Đoạn text được chia nhỏ từ document, kèm embedding vector |
| Embedding | Vector biểu diễn ngữ nghĩa của text (float array 384-3072 dims) |
| Vector Search | Tìm kiếm dựa trên cosine similarity giữa embedding vectors |
| PostgreSQL 18 | RDBMS mới nhất (released 2025-09-25, current 18.3) |
| MongoDB | NoSQL document database cho unstructured data |

### 1.4 References
- xClaw Architecture Document (docs/architecture.md)
- xClaw Skill Development Guide (docs/skill-development.md)
- xClaw API Reference (docs/api-reference.md)
- [PostgreSQL 18 Release Notes](https://www.postgresql.org/docs/18/release-18.html)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [MCP Specification](https://spec.modelcontextprotocol.io/) — Model Context Protocol standard
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- OpenAI API Reference
- [LangChain Text Splitters](https://js.langchain.com/docs/modules/data_connection/document_transformers/) — Chunking strategies reference

### 1.5 PostgreSQL 18 Key Features Used

| Feature | Usage in xClaw |
|---|---|
| `uuidv7()` | Time-sortable UUIDs cho model profiles, usage records |
| Async I/O subsystem | Better performance cho batch usage queries |
| Virtual generated columns | Computed fields (cost_estimate, display_name) |
| Temporal constraints (WITHOUT OVERLAPS) | Model session time ranges |
| OAuth authentication | Secure access cho multi-user deployment |
| Skip scan B-tree indexes | Fast queries trên multi-column indexes |
| `OLD`/`NEW` RETURNING | Audit trail khi update model configs |

---

## 2. Overall Description

### 2.1 Product Perspective — Dual Database Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         xClaw Platform                            │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────────────┐ │
│  │ Web UI   │  │ Gateway  │  │   Model Management Skill         │ │
│  │ (React)  │──│(WS+REST) │──│   (SkillPlugin pattern)          │ │
│  └──────────┘  └──────────┘  │                                   │ │
│                               │  ┌────────────┐ ┌─────────────┐ │ │
│  ┌──────────┐  ┌──────────┐  │  │PostgreSQL18│ │  MongoDB     │ │ │
│  │  Agent   │──│LLM Router│──│  │ (Relational)│ │ (Documents) │ │ │
│  │  Core    │  │          │  │  └────────────┘ └─────────────┘ │ │
│  └──────────┘  └──────────┘  └─────────────────────────────────┘ │
│                                        │                          │
│                    ┌───────────┬────────┼──────────┐              │
│                    ▼           ▼        ▼          ▼              │
│               ┌────────┐ ┌────────┐ ┌───────┐ ┌──────┐          │
│               │ Ollama │ │ OpenAI │ │Claude │ │Google│          │
│               └────────┘ └────────┘ └───────┘ └──────┘          │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Database Role Separation

| Database | Role | Data Types |
|---|---|---|
| **PostgreSQL 18** | Structured, relational, ACID | Model profiles, provider configs, usage records, benchmark results, model sessions, permissions, audit logs |
| **MongoDB** | Unstructured, flexible schema | Chat conversations, raw LLM responses, memory entries, embeddings (vector), prompt templates, model fine-tune datasets, error logs (JSON blobs) |

**Lý do dùng cả 2:**
- **PostgreSQL 18**: Cần ACID cho model config, foreign keys cho data integrity, SQL queries cho aggregation/reporting, `uuidv7()` cho sortable IDs, temporal constraints cho session management
- **MongoDB**: Chat messages có schema linh hoạt (khác nhau per provider), embeddings cần document model, raw LLM responses là JSON blobs lớn khác structure, conversation context thay đổi liên tục

### 2.3 Product Functions (High-Level)
1. **Model Registry Management** — Duyệt, tìm kiếm models có sẵn
2. **Model CRUD** — Thêm, sửa, xóa model profiles (PG18)
3. **Model Pull/Download** — Tải models từ Ollama registry
4. **Model Switching** — Chuyển đổi model cho sessions
5. **Model Benchmark** — Test tốc độ, chất lượng, tool calling
6. **Usage Tracking** — Theo dõi token usage, cost (PG18)
7. **Conversation Storage** — Lưu chat history (MongoDB)
8. **Memory & Embeddings** — Vector search cho RAG (MongoDB)
9. **Model Health Monitor** — Kiểm tra trạng thái provider
10. **Default Model Config** — Quản lý model mặc định cho agent

### 2.4 Skill Architecture — Model Management as SkillPlugin

Model Management được thiết kế theo đúng pattern SkillPlugin của xClaw:

```typescript
// Model Management = SkillPlugin
const modelManagementSkill: SkillPlugin = {
  manifest: {
    id: 'model-management',
    name: 'Model Management',
    version: '2.0.0',
    description: 'Manage LLM models, providers, benchmarks, and usage',
    author: 'xClaw',
    category: 'productivity',
    tags: ['llm', 'model', 'ollama', 'benchmark', 'provider'],
    
    tools: [
      // 12 tools exposed to the Agent's LLM
      { name: 'model_list', ... },
      { name: 'model_create', ... },
      { name: 'model_update', ... },
      { name: 'model_delete', ... },
      { name: 'model_switch', ... },
      { name: 'model_get_active', ... },
      { name: 'model_benchmark', ... },
      { name: 'model_test_connection', ... },
      { name: 'ollama_list', ... },
      { name: 'ollama_pull', ... },
      { name: 'ollama_remove', ... },
      { name: 'provider_health_check', ... },
    ],
    
    config: [
      { key: 'pgConnectionString', label: 'PostgreSQL URL', type: 'string', required: true,
        default: 'postgresql://xclaw:xclaw@localhost:5432/xclaw' },
      { key: 'mongoConnectionString', label: 'MongoDB URL', type: 'string', required: true,
        default: 'mongodb://localhost:27017/xclaw' },
      { key: 'ollamaBaseUrl', label: 'Ollama Base URL', type: 'string', 
        default: 'http://localhost:11434' },
      { key: 'encryptionKey', label: 'API Key Encryption Key', type: 'secret' },
      { key: 'autoImportEnv', label: 'Auto-import from .env', type: 'boolean', default: true },
    ],

    dependencies: [],  // No dependency on other skills
  },
  
  async activate(context: SkillContext) {
    // 1. Connect PostgreSQL 18
    // 2. Connect MongoDB
    // 3. Run PG migrations
    // 4. Create MongoDB indexes
    // 5. Register all 12 tools
    // 6. Auto-import .env config if first boot
    // 7. Start health check interval
  },
  
  async deactivate() {
    // Close DB connections, stop intervals
  }
};
```

### 2.5 User Classes and Characteristics

| User Class | Description | Technical Level |
|---|---|---|
| Admin | Quản lý toàn bộ models, cấu hình hệ thống | High |
| Developer | Thêm/sửa model profiles, benchmark | Medium-High |
| End User | Chat, chọn model từ danh sách đã config | Low |
| Agent (LLM) | Gọi tools để tương tác với models | N/A (automated) |

### 2.6 Operating Environment
- **Runtime**: Node.js 22+, Linux/macOS/Windows
- **PostgreSQL**: 18.x (current 18.3, released Feb 2026)
- **MongoDB**: 7.x+ (or 8.x)
- **LLM Providers**: Ollama (local), OpenAI, Anthropic, Google AI
- **Hardware Target**: i5-13400, 32GB RAM, no GPU → ưu tiên local Ollama models

### 2.7 Constraints
- Design as SkillPlugin — follow `defineSkill()` pattern
- PostgreSQL 18 cho structured data, MongoDB cho unstructured
- Phải hoạt động offline với Ollama models (MongoDB/PG local)
- Memory footprint thấp
- Tương thích với kiến trúc Gateway hiện tại
- API: RESTful + WebSocket events + Skill tools

---

## 3. Functional Requirements

### 3.1 Skill Lifecycle (NEW)

#### FR-SKILL-001: Skill Registration
| Field | Detail |
|---|---|
| **ID** | FR-SKILL-001 |
| **Priority** | Must Have |
| **Description** | Model Management đăng ký như SkillPlugin qua `SkillManager.register()` |
| **Rules** | - Manifest phải có đầy đủ 12 tools<br>- Config schema define DB connections<br>- Category: 'productivity' |

#### FR-SKILL-002: Skill Activation
| Field | Detail |
|---|---|
| **ID** | FR-SKILL-002 |
| **Priority** | Must Have |
| **Description** | Khi activate: connect PG18 + MongoDB, run migrations, register tools |
| **Input** | SkillContext (toolRegistry, eventBus, config, log) |
| **Steps** | 1. Parse config (PG URL, Mongo URL, etc.)<br>2. Init PostgreSQL 18 connection pool<br>3. Init MongoDB client<br>4. Run PG migrations<br>5. Create Mongo indexes<br>6. Register 12 tools via `context.toolRegistry`<br>7. Auto-import from .env if first boot |

#### FR-SKILL-003: Skill Deactivation
| Field | Detail |
|---|---|
| **ID** | FR-SKILL-003 |
| **Priority** | Must Have |
| **Description** | Graceful shutdown: close DB pools, stop health intervals |

#### FR-SKILL-004: Tool Exposure to Agent
| Field | Detail |
|---|---|
| **ID** | FR-SKILL-004 |
| **Priority** | Must Have |
| **Description** | 12 tools registered vào Agent's LLM tool calling system |
| **Rules** | - Agent có thể dùng natural language để gọi model tools<br>- Ví dụ: "List all my models" → Agent calls `model_list` tool |

### 3.2 Model Profile Management (PostgreSQL 18)

#### FR-MODEL-001: Create Model Profile
| Field | Detail |
|---|---|
| **ID** | FR-MODEL-001 |
| **Priority** | Must Have |
| **Description** | Tạo model profile mới, lưu vào PostgreSQL 18 |
| **Tool** | `model_create` |
| **Storage** | PostgreSQL 18 — `model_profiles` table |
| **Validation** | - Tên model unique<br>- Provider hợp lệ<br>- UUID v7 auto-generated |

#### FR-MODEL-002: List Model Profiles
| Field | Detail |
|---|---|
| **ID** | FR-MODEL-002 |
| **Priority** | Must Have |
| **Tool** | `model_list` |
| **Storage** | PostgreSQL 18 — query with skip scan indexes |
| **Output** | Array ModelProfile (NO API keys) |

#### FR-MODEL-003: Update Model Profile
| Field | Detail |
|---|---|
| **ID** | FR-MODEL-003 |
| **Priority** | Must Have |
| **Tool** | `model_update` |
| **Storage** | PostgreSQL 18 — with `OLD`/`NEW` RETURNING for audit |

#### FR-MODEL-004: Delete Model Profile
| Field | Detail |
|---|---|
| **ID** | FR-MODEL-004 |
| **Priority** | Must Have |
| **Tool** | `model_delete` |
| **Rules** | - Soft delete (deleted_at timestamp)<br>- Cannot delete active/default model |

#### FR-MODEL-005: Set Default Model
| Field | Detail |
|---|---|
| **ID** | FR-MODEL-005 |
| **Priority** | Must Have |
| **Tool** | `model_switch` (scope: 'default') |
| **Rules** | - Only 1 default at a time<br>- Model must be available |

### 3.3 Ollama Integration

#### FR-OLLAMA-001: List Local Models
| Field | Detail |
|---|---|
| **ID** | FR-OLLAMA-001 |
| **Priority** | Must Have |
| **Tool** | `ollama_list` |
| **Output** | Array with name, size, modified, format, family, parameters |

#### FR-OLLAMA-002: Pull Model
| Field | Detail |
|---|---|
| **ID** | FR-OLLAMA-002 |
| **Priority** | Must Have |
| **Tool** | `ollama_pull` |
| **Output** | WebSocket stream progress events |
| **Rules** | - Check disk space before pull<br>- Auto-create PG model profile after pull |

#### FR-OLLAMA-003: Remove Model
| Field | Detail |
|---|---|
| **ID** | FR-OLLAMA-003 |
| **Priority** | Should Have |
| **Tool** | `ollama_remove` |

### 3.4 Model Switching & Routing

#### FR-SWITCH-001: Switch Active Model
| Field | Detail |
|---|---|
| **ID** | FR-SWITCH-001 |
| **Priority** | Must Have |
| **Tool** | `model_switch` |
| **Storage** | PostgreSQL 18 — `model_sessions` with temporal constraints |
| **Scopes** | global (default) / session (override) |

#### FR-SWITCH-002: Per-Session Override
| Field | Detail |
|---|---|
| **ID** | FR-SWITCH-002 |
| **Priority** | Should Have |
| **Description** | Mỗi session dùng model khác, temporal constraint đảm bảo no overlapping |

#### FR-SWITCH-003: Fallback Chain
| Field | Detail |
|---|---|
| **ID** | FR-SWITCH-003 |
| **Priority** | Could Have |
| **Description** | Nếu model chính fail, auto-switch sang backup |

### 3.5 Benchmark & Testing

#### FR-BENCH-001: Run Benchmark
| Field | Detail |
|---|---|
| **ID** | FR-BENCH-001 |
| **Priority** | Should Have |
| **Tool** | `model_benchmark` |
| **Storage** | PostgreSQL 18 — `benchmark_results` table |
| **Tests** | Speed, code quality, tool calling, Vietnamese, context length |

### 3.6 Usage Tracking

#### FR-USAGE-001: Track Token Usage
| Field | Detail |
|---|---|
| **ID** | FR-USAGE-001 |
| **Priority** | Must Have |
| **Storage** | PostgreSQL 18 — `usage_records` table (ACID, aggregation) |
| **Virtual Column** | `cost_estimate` as virtual generated column (PG18 feature) |

#### FR-USAGE-002: Usage Statistics
| Field | Detail |
|---|---|
| **ID** | FR-USAGE-002 |
| **Priority** | Should Have |
| **Storage** | PostgreSQL 18 — SQL aggregation, GROUP BY with skip scan |

### 3.7 Conversation & Memory (MongoDB)

#### FR-CONV-001: Store Chat Conversations
| Field | Detail |
|---|---|
| **ID** | FR-CONV-001 |
| **Priority** | Must Have |
| **Storage** | MongoDB — `conversations` collection |
| **Reason** | Schema varies per provider, messages can have attachments, tool calls, images |

#### FR-CONV-002: Store Memory Entries
| Field | Detail |
|---|---|
| **ID** | FR-CONV-002 |
| **Priority** | Must Have |
| **Storage** | MongoDB — `memory_entries` collection |
| **Reason** | Embeddings (vector arrays), variable metadata, flexible search |

#### FR-CONV-003: Store Raw LLM Responses
| Field | Detail |
|---|---|
| **ID** | FR-CONV-003 |
| **Priority** | Should Have |
| **Storage** | MongoDB — `llm_responses` collection |
| **Reason** | Full response payloads differ per provider, debugging/audit |

#### FR-CONV-004: Prompt Template Library
| Field | Detail |
|---|---|
| **ID** | FR-CONV-004 |
| **Priority** | Could Have |
| **Storage** | MongoDB — `prompt_templates` collection |
| **Reason** | Templates are nested docs with variables, versions, examples |

### 3.8 Health Monitoring

#### FR-HEALTH-001: Provider Health Check
| Field | Detail |
|---|---|
| **ID** | FR-HEALTH-001 |
| **Priority** | Must Have |
| **Tool** | `provider_health_check` |
| **Checks** | Ollama, OpenAI, Anthropic, Google + PG18 + MongoDB + MCP servers connectivity |

### 3.9 MCP Server Management (theo chuyên đề)

MCP (Model Context Protocol) servers cung cấp external tools cho Agent theo từng chuyên đề/lĩnh vực. xClaw quản lý MCP servers như "domain tool packs" — mỗi server chuyên 1 lĩnh vực.

#### 3.9.1 MCP Domain Categories

| Domain | Category | Ví dụ MCP Servers | Tools Provided |
|---|---|---|---|
| 🧑‍💻 **Code & Development** | `code` | GitHub MCP, GitLab MCP, File System MCP | create_pr, search_code, list_issues, read_file |
| 🌐 **Web & Browser** | `web` | Chrome DevTools MCP, Puppeteer MCP | navigate, screenshot, click, evaluate_script |
| 🗄️ **Data & Database** | `data` | PostgreSQL MCP, MongoDB MCP, SQLite MCP | query, insert, create_table, aggregate |
| 📊 **Productivity** | `productivity` | Google Workspace MCP, Notion MCP, Slack MCP | send_message, create_doc, schedule_event |
| 📚 **Knowledge** | `knowledge` | Web Search MCP, Wikipedia MCP, ArXiv MCP | search_web, fetch_article, search_papers |
| 🔧 **DevOps** | `devops` | Docker MCP, Kubernetes MCP, AWS MCP | deploy, scale, logs, build_image |
| 🎨 **Media** | `media` | Image Gen MCP, TTS MCP, OCR MCP | generate_image, text_to_speech, extract_text |
| 🔌 **Custom** | `custom` | User-defined MCP servers | Any tools |

#### FR-MCP-001: Register MCP Server
| Field | Detail |
|---|---|
| **ID** | FR-MCP-001 |
| **Priority** | Must Have |
| **Tool** | `mcp_register` |
| **Storage** | PostgreSQL 18 — `mcp_servers` table |
| **Input** | name, domain, transport (stdio/sse/streamable-http), command/URL, env vars, description |
| **Rules** | - Unique name per server<br>- Validate transport config<br>- Auto-discover available tools from server |

#### FR-MCP-002: List MCP Servers (by Domain)
| Field | Detail |
|---|---|
| **ID** | FR-MCP-002 |
| **Priority** | Must Have |
| **Tool** | `mcp_list` |
| **Output** | Grouped by domain category, with status + tool count |

#### FR-MCP-003: Enable/Disable MCP Server per Session
| Field | Detail |
|---|---|
| **ID** | FR-MCP-003 |
| **Priority** | Must Have |
| **Tool** | `mcp_toggle` |
| **Description** | Enable/disable MCP server cho agent. Khi enable, tools từ MCP server được inject vào Agent's available tools |
| **Rules** | - Per-session hoặc global enable<br>- Disabled = tools removed from Agent |

#### FR-MCP-004: MCP Tool Discovery
| Field | Detail |
|---|---|
| **ID** | FR-MCP-004 |
| **Priority** | Must Have |
| **Description** | Khi connect MCP server, auto-discover tất cả tools + resources + prompts it provides |
| **Storage** | PostgreSQL 18 — `mcp_tools` table (cache discovered tools) |

#### FR-MCP-005: MCP Health Check
| Field | Detail |
|---|---|
| **ID** | FR-MCP-005 |
| **Priority** | Should Have |
| **Tool** | `mcp_health` |
| **Description** | Check connectivity + response time cho từng MCP server |

#### FR-MCP-006: MCP Server Presets (Curated Domains)
| Field | Detail |
|---|---|
| **ID** | FR-MCP-006 |
| **Priority** | Should Have |
| **Description** | Built-in presets cho phổ biến MCP servers (GitHub, Chrome DevTools, file system) |
| **Rules** | - One-click setup từ preset<br>- Auto-configure transport + env vars |

### 3.10 RAG Pipeline & Knowledge Base

RAG (Retrieval-Augmented Generation) cho phép Agent truy vấn knowledge base để trả lời chính xác hơn. Knowledge data được quản lý qua Collections → Documents → Chunks → Embeddings.

#### 3.10.1 RAG Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │        Knowledge Management          │
                    │                                       │
 Upload ──────────▶ │  Documents → Chunking → Embedding    │
 (PDF/MD/URL/Text)  │       │          │          │        │
                    │       ▼          ▼          ▼        │
                    │  ┌─────────────────────────────────┐ │
                    │  │         MongoDB                  │ │
                    │  │  knowledge_documents (originals) │ │
                    │  │  knowledge_chunks (text+vectors) │ │
                    │  └─────────────────────────────────┘ │
                    └─────────────────┬───────────────────┘
                                      │
 User asks question                   │
        │                             │
        ▼                             ▼
 ┌──────────────┐            ┌──────────────────┐
 │ Embed query  │───────────▶│  Vector Search    │
 │ (same model) │            │  (cosine sim)     │
 └──────────────┘            │  Top-K chunks     │
                             └────────┬─────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │ Inject top chunks │
                             │ into LLM prompt   │
                             │ as context         │
                             └────────┬─────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │  LLM generates    │
                             │  grounded answer   │
                             │  with citations    │
                             └──────────────────┘
```

#### 3.10.2 Knowledge Data Hierarchy

```
Knowledge Base
├── 📁 Collection: "xClaw Documentation"
│   ├── 📄 Document: architecture.md (source: file)
│   │   ├── 🧩 Chunk 1: "## Gateway Architecture..." + embedding[384]
│   │   ├── 🧩 Chunk 2: "## Skill System..." + embedding[384]
│   │   └── 🧩 Chunk 3: "## LLM Router..." + embedding[384]
│   ├── 📄 Document: api-reference.md (source: file)
│   └── 📄 Document: skill-development.md (source: file)
│
├── 📁 Collection: "TypeScript Best Practices"
│   ├── 📄 Document: ts-handbook.pdf (source: upload)
│   └── 📄 Document: effective-ts.md (source: URL crawl)
│
└── 📁 Collection: "Company Wiki"
    ├── 📄 Document: onboarding.md (source: manual)
    └── 📄 Document: coding-standards.md (source: URL)
```

#### FR-RAG-001: Create Knowledge Collection
| Field | Detail |
|---|---|
| **ID** | FR-RAG-001 |
| **Priority** | Must Have |
| **Tool** | `kb_create_collection` |
| **Storage** | MongoDB — `knowledge_collections` |
| **Input** | name, description, embedding model, chunk strategy |
| **Rules** | - Unique name<br>- Choose embedding model from available models<br>- Default chunk size: 512 tokens, overlap: 50 tokens |

#### FR-RAG-002: Upload/Add Document
| Field | Detail |
|---|---|
| **ID** | FR-RAG-002 |
| **Priority** | Must Have |
| **Tool** | `kb_add_document` |
| **Sources** | File upload (PDF, MD, TXT, DOCX), URL crawl, manual text, code file |
| **Pipeline** | 1. Parse document (extract text)<br>2. Chunk text (recursive splitter)<br>3. Embed each chunk<br>4. Store in MongoDB |
| **Storage** | MongoDB — `knowledge_documents` + `knowledge_chunks` |

#### FR-RAG-003: Semantic Search
| Field | Detail |
|---|---|
| **ID** | FR-RAG-003 |
| **Priority** | Must Have |
| **Tool** | `kb_search` |
| **Input** | query text, collection filter (optional), top-K limit |
| **Process** | 1. Embed query<br>2. Cosine similarity search against chunk embeddings<br>3. Return top-K chunks with scores + source info |
| **Storage** | MongoDB — vector search on `knowledge_chunks` |

#### FR-RAG-004: Auto-RAG in Chat
| Field | Detail |
|---|---|
| **ID** | FR-RAG-004 |
| **Priority** | Must Have |
| **Description** | Khi RAG enabled, mỗi user message tự động search knowledge base → inject relevant chunks vào system prompt |
| **Config** | Enable/disable per collection, top-K (default 5), min score threshold (0.7) |

#### FR-RAG-005: List Collections & Documents
| Field | Detail |
|---|---|
| **ID** | FR-RAG-005 |
| **Priority** | Must Have |
| **Tool** | `kb_list_collections`, `kb_list_documents` |
| **Output** | Collections with doc count, chunk count, total size |

#### FR-RAG-006: Delete Document / Collection
| Field | Detail |
|---|---|
| **ID** | FR-RAG-006 |
| **Priority** | Must Have |
| **Tool** | `kb_delete_document`, `kb_delete_collection` |
| **Rules** | - Cascade delete: collection → documents → chunks<br>- Soft delete with cleanup job |

#### FR-RAG-007: Re-embed Collection
| Field | Detail |
|---|---|
| **ID** | FR-RAG-007 |
| **Priority** | Should Have |
| **Tool** | `kb_reembed` |
| **Description** | Khi switch sang embedding model khác, re-embed toàn bộ chunks trong collection |

#### FR-RAG-008: Chunk Preview & Management
| Field | Detail |
|---|---|
| **ID** | FR-RAG-008 |
| **Priority** | Should Have |
| **Description** | Xem chunks đã tạo, edit chunk boundaries, xem embedding quality |

#### FR-RAG-009: Web URL Crawler
| Field | Detail |
|---|---|
| **ID** | FR-RAG-009 |
| **Priority** | Could Have |
| **Description** | Input URL → crawl HTML → extract text → chunk → embed |
| **Rules** | - Respect robots.txt<br>- Max depth configurable<br>- Schedule re-crawl |

#### FR-RAG-010: RAG Analytics
| Field | Detail |
|---|---|
| **ID** | FR-RAG-010 |
| **Priority** | Could Have |
| **Storage** | PostgreSQL 18 — `rag_query_log` table |
| **Description** | Track: query → which chunks retrieved → was answer helpful? |

---

## 4. Non-Functional Requirements

### NFR-4.1: Performance
| ID | Requirement |
|---|---|
| NFR-PERF-001 | API list models < 100ms (PG18 skip scan) |
| NFR-PERF-002 | Switch model < 500ms |
| NFR-PERF-003 | PG queries < 50ms, Mongo queries < 100ms |
| NFR-PERF-004 | Skill activation (connect DBs) < 5s |
| NFR-PERF-005 | RAG vector search (top-10) < 200ms |
| NFR-PERF-006 | Document chunking + embedding < 30s per 10KB document |
| NFR-PERF-007 | MCP server discovery < 3s |

### NFR-4.2: Reliability
| ID | Requirement |
|---|---|
| NFR-REL-001 | Graceful degradation nếu MongoDB unavailable (PG vẫn hoạt động) |
| NFR-REL-002 | Graceful degradation nếu PG unavailable (fallback to .env) |
| NFR-REL-003 | Connection pooling cho cả PG + Mongo |

### NFR-4.3: Security
| ID | Requirement |
|---|---|
| NFR-SEC-001 | API keys encrypted (AES-256-GCM) trong PG18 |
| NFR-SEC-002 | API keys NEVER returned in API responses |
| NFR-SEC-003 | Parameterized queries (PG), sanitized inputs (Mongo) |
| NFR-SEC-004 | PG18 OAuth support cho multi-user setup |

### NFR-4.4: Compatibility
| ID | Requirement |
|---|---|
| NFR-COMP-001 | Node.js 22+ |
| NFR-COMP-002 | PostgreSQL 18.x (minumum 18.0) |
| NFR-COMP-003 | MongoDB 7.x+ |
| NFR-COMP-004 | Backwards-compatible với .env config |
| NFR-COMP-005 | Follows SkillPlugin pattern exactly |

---

## 5. Skill Tool Definitions (22 Tools)

```typescript
const tools: ToolDefinition[] = [
  // ─── Model CRUD ─────────────────
  {
    name: 'model_list',
    description: 'List all configured LLM model profiles with their status',
    category: 'model-management',
    parameters: [
      { name: 'provider', type: 'string', description: 'Filter by provider: ollama, openai, anthropic, google', required: false },
      { name: 'status', type: 'string', description: 'Filter by status: available, unavailable, error', required: false },
    ],
    returns: { name: 'models', type: 'array', description: 'Array of model profiles' },
  },
  {
    name: 'model_create',
    description: 'Create a new LLM model profile configuration',
    category: 'model-management',
    parameters: [
      { name: 'name', type: 'string', description: 'Display name for the model', required: true },
      { name: 'provider', type: 'string', description: 'Provider type', required: true, enum: ['ollama', 'openai', 'anthropic', 'google', 'custom'] },
      { name: 'modelId', type: 'string', description: 'Provider model ID (e.g. qwen2.5:1.5b)', required: true },
      { name: 'apiKey', type: 'string', description: 'API key for cloud providers', required: false },
      { name: 'baseUrl', type: 'string', description: 'Custom API base URL', required: false },
      { name: 'temperature', type: 'number', description: 'Temperature 0.0-2.0', required: false },
      { name: 'maxTokens', type: 'number', description: 'Max response tokens', required: false },
    ],
    returns: { name: 'profile', type: 'object', description: 'Created model profile' },
  },
  {
    name: 'model_update',
    description: 'Update an existing model profile configuration',
    category: 'model-management',
    parameters: [
      { name: 'id', type: 'string', description: 'Model profile ID', required: true },
      { name: 'updates', type: 'object', description: 'Fields to update', required: true },
    ],
    returns: { name: 'profile', type: 'object', description: 'Updated model profile' },
  },
  {
    name: 'model_delete',
    description: 'Delete a model profile (soft delete)',
    category: 'model-management',
    parameters: [
      { name: 'id', type: 'string', description: 'Model profile ID', required: true },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, message }' },
  },

  // ─── Model Operations ──────────
  {
    name: 'model_switch',
    description: 'Switch the active LLM model for chat',
    category: 'model-management',
    parameters: [
      { name: 'id', type: 'string', description: 'Model profile ID to switch to', required: true },
      { name: 'scope', type: 'string', description: 'default (global) or session (current only)', required: false, enum: ['default', 'session'] },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, model }' },
  },
  {
    name: 'model_get_active',
    description: 'Get the currently active model profile',
    category: 'model-management',
    parameters: [],
    returns: { name: 'model', type: 'object', description: 'Active model profile' },
  },
  {
    name: 'model_benchmark',
    description: 'Run performance benchmark on a model (speed, quality, tool calling)',
    category: 'model-management',
    parameters: [
      { name: 'id', type: 'string', description: 'Model profile ID to benchmark', required: true },
      { name: 'tests', type: 'array', description: 'Tests to run: speed, code, tool_calling, vietnamese', required: false },
    ],
    returns: { name: 'result', type: 'object', description: 'BenchmarkResult with scores' },
    timeout: 120000,
  },
  {
    name: 'model_test_connection',
    description: 'Test if a model is reachable and working',
    category: 'model-management',
    parameters: [
      { name: 'id', type: 'string', description: 'Model profile ID to test', required: true },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, latencyMs, tokensPerSecond }' },
    timeout: 30000,
  },

  // ─── Ollama Operations ──────────
  {
    name: 'ollama_list',
    description: 'List all models available in local Ollama installation',
    category: 'model-management',
    parameters: [],
    returns: { name: 'models', type: 'array', description: 'Local Ollama models with size and details' },
  },
  {
    name: 'ollama_pull',
    description: 'Download/pull a model from Ollama registry',
    category: 'model-management',
    parameters: [
      { name: 'name', type: 'string', description: 'Model name to pull (e.g. qwen2.5:3b)', required: true },
      { name: 'autoRegister', type: 'boolean', description: 'Auto-create profile after pull', required: false },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, profileId, size }' },
    timeout: 600000,
  },
  {
    name: 'ollama_remove',
    description: 'Remove a model from local Ollama installation',
    category: 'model-management',
    parameters: [
      { name: 'name', type: 'string', description: 'Model name to remove', required: true },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, message }' },
    requiresApproval: true,
  },

  // ─── Health ─────────────────────
  {
    name: 'provider_health_check',
    description: 'Check health status of all LLM providers and databases',
    category: 'model-management',
    parameters: [
      { name: 'provider', type: 'string', description: 'Check specific provider only', required: false },
    ],
    returns: { name: 'health', type: 'object', description: 'Health status per provider' },
  },

  // ─── MCP Server Management ────────
  {
    name: 'mcp_register',
    description: 'Register a new MCP server by domain category',
    category: 'model-management',
    parameters: [
      { name: 'name', type: 'string', description: 'Display name', required: true },
      { name: 'domain', type: 'string', description: 'Domain category: code, web, data, productivity, knowledge, devops, media, custom', required: true },
      { name: 'transport', type: 'string', description: 'Transport type: stdio, sse, streamable-http', required: true },
      { name: 'command', type: 'string', description: 'Command to start MCP server (stdio) or URL (sse/http)', required: true },
      { name: 'args', type: 'array', description: 'Command arguments', required: false },
      { name: 'env', type: 'object', description: 'Environment variables for MCP server', required: false },
    ],
    returns: { name: 'server', type: 'object', description: 'Registered MCP server with discovered tools' },
  },
  {
    name: 'mcp_list',
    description: 'List all registered MCP servers grouped by domain',
    category: 'model-management',
    parameters: [
      { name: 'domain', type: 'string', description: 'Filter by domain category', required: false },
      { name: 'status', type: 'string', description: 'Filter by status: active, inactive, error', required: false },
    ],
    returns: { name: 'servers', type: 'object', description: 'MCP servers grouped by domain' },
  },
  {
    name: 'mcp_toggle',
    description: 'Enable or disable a MCP server for the current agent session',
    category: 'model-management',
    parameters: [
      { name: 'serverId', type: 'string', description: 'MCP server ID', required: true },
      { name: 'enabled', type: 'boolean', description: 'Enable (true) or disable (false)', required: true },
      { name: 'scope', type: 'string', description: 'global or session', required: false },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, toolsAdded/Removed }' },
  },
  {
    name: 'mcp_health',
    description: 'Check health and connectivity of MCP servers',
    category: 'model-management',
    parameters: [
      { name: 'serverId', type: 'string', description: 'Check specific server only', required: false },
    ],
    returns: { name: 'health', type: 'object', description: 'Health status per MCP server' },
  },

  // ─── RAG / Knowledge Base ─────────
  {
    name: 'kb_create_collection',
    description: 'Create a new knowledge collection for RAG',
    category: 'model-management',
    parameters: [
      { name: 'name', type: 'string', description: 'Collection name', required: true },
      { name: 'description', type: 'string', description: 'What this collection contains', required: false },
      { name: 'embeddingModel', type: 'string', description: 'Model to use for embeddings (default: active model)', required: false },
      { name: 'chunkSize', type: 'number', description: 'Target chunk size in tokens (default: 512)', required: false },
      { name: 'chunkOverlap', type: 'number', description: 'Overlap between chunks (default: 50)', required: false },
    ],
    returns: { name: 'collection', type: 'object', description: 'Created collection' },
  },
  {
    name: 'kb_add_document',
    description: 'Add a document to a knowledge collection (auto chunks + embeds)',
    category: 'model-management',
    parameters: [
      { name: 'collectionId', type: 'string', description: 'Target collection ID', required: true },
      { name: 'source', type: 'string', description: 'Source type: file, url, text', required: true },
      { name: 'content', type: 'string', description: 'File path, URL, or raw text content', required: true },
      { name: 'title', type: 'string', description: 'Document title', required: false },
      { name: 'metadata', type: 'object', description: 'Custom metadata tags', required: false },
    ],
    returns: { name: 'document', type: 'object', description: '{ id, title, chunkCount, status }' },
    timeout: 120000,
  },
  {
    name: 'kb_search',
    description: 'Semantic search across knowledge base using vector similarity',
    category: 'model-management',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query in natural language', required: true },
      { name: 'collectionId', type: 'string', description: 'Search in specific collection only', required: false },
      { name: 'topK', type: 'number', description: 'Number of results (default: 5)', required: false },
      { name: 'minScore', type: 'number', description: 'Minimum similarity score 0-1 (default: 0.7)', required: false },
    ],
    returns: { name: 'results', type: 'array', description: 'Matching chunks with scores and source info' },
  },
  {
    name: 'kb_list_collections',
    description: 'List all knowledge collections with stats',
    category: 'model-management',
    parameters: [],
    returns: { name: 'collections', type: 'array', description: 'Collections with document count, chunk count, size' },
  },
  {
    name: 'kb_delete_collection',
    description: 'Delete a knowledge collection and all its documents/chunks',
    category: 'model-management',
    parameters: [
      { name: 'collectionId', type: 'string', description: 'Collection ID to delete', required: true },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, deletedDocs, deletedChunks }' },
    requiresApproval: true,
  },
  {
    name: 'kb_delete_document',
    description: 'Delete a document and its chunks from a collection',
    category: 'model-management',
    parameters: [
      { name: 'documentId', type: 'string', description: 'Document ID to delete', required: true },
    ],
    returns: { name: 'result', type: 'object', description: '{ success, deletedChunks }' },
  },
];
```

---

## 6. Traceability Matrix

| Requirement | Priority | Storage | Skill Tool | Status |
|---|---|---|---|---|
| FR-SKILL-001 | Must | — | All tools | Planned |
| FR-SKILL-002 | Must | PG18 + Mongo | — | Planned |
| FR-MODEL-001 | Must | PG18 | `model_create` | Planned |
| FR-MODEL-002 | Must | PG18 | `model_list` | Planned |
| FR-MODEL-003 | Must | PG18 | `model_update` | Planned |
| FR-MODEL-004 | Must | PG18 | `model_delete` | Planned |
| FR-MODEL-005 | Must | PG18 | `model_switch` | Planned |
| FR-OLLAMA-001 | Must | — | `ollama_list` | Planned |
| FR-OLLAMA-002 | Must | PG18 | `ollama_pull` | Planned |
| FR-SWITCH-001 | Must | PG18 | `model_switch` | Planned |
| FR-BENCH-001 | Should | PG18 | `model_benchmark` | Planned |
| FR-USAGE-001 | Must | PG18 | — (auto) | Planned |
| FR-CONV-001 | Must | MongoDB | — (auto) | Planned |
| FR-CONV-002 | Must | MongoDB | — (auto) | Planned |
| FR-HEALTH-001 | Must | — | `provider_health_check` | Planned |
| **FR-MCP-001** | **Must** | **PG18** | **`mcp_register`** | **Planned** |
| **FR-MCP-002** | **Must** | **PG18** | **`mcp_list`** | **Planned** |
| **FR-MCP-003** | **Must** | **PG18** | **`mcp_toggle`** | **Planned** |
| **FR-MCP-004** | **Must** | **PG18** | **`mcp_register`** | **Planned** |
| **FR-MCP-005** | **Should** | **—** | **`mcp_health`** | **Planned** |
| **FR-RAG-001** | **Must** | **MongoDB** | **`kb_create_collection`** | **Planned** |
| **FR-RAG-002** | **Must** | **MongoDB** | **`kb_add_document`** | **Planned** |
| **FR-RAG-003** | **Must** | **MongoDB** | **`kb_search`** | **Planned** |
| **FR-RAG-004** | **Must** | **MongoDB** | **— (auto)** | **Planned** |
| **FR-RAG-005** | **Must** | **MongoDB** | **`kb_list_collections`** | **Planned** |
| **FR-RAG-006** | **Must** | **MongoDB** | **`kb_delete_*`** | **Planned** |
