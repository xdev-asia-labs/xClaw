# Software Requirements Specification (SRS)

## xClaw SkillHub — Community Skill Marketplace

**Version:** 1.0.0  
**Date:** 2026-03-17  
**Author:** xClaw Team  
**Status:** Draft  

---

## 1. Introduction

### 1.1 Purpose

Tài liệu này mô tả đầy đủ các yêu cầu phần mềm cho **SkillHub** — Marketplace cho phép cộng đồng tạo, chia sẻ, import và quản lý Skills trong hệ thống xClaw AI Agent Platform.

SkillHub giải quyết 3 vấn đề chính:

1. **Thiếu kho skill cộng đồng** — Hiện tại xClaw chỉ có 12 skill built-in, chưa có marketplace để cộng đồng đóng góp
2. **Không thể import skill từ bên ngoài** — Chưa có adapter để import skills từ Anthropic's Skills, MCP servers, hoặc community repos
3. **User muốn tạo skill riêng** — Thiếu workflow cho user tạo skill → submit → review → merge vào marketplace

### 1.2 Scope

SkillHub bao gồm:

- **SkillHub Registry** — Kho skills trung tâm với metadata, versioning, ratings
- **Anthropic Skill Importer** — Import skills từ `github.com/anthropics/skills` repo, convert SKILL.md → xClaw SkillManifest
- **MCP Server Importer** — Import MCP servers và wrap thành xClaw skills
- **User Skill Submission** — Workflow cho user tạo skill → submit PR → review → merge
- **Skill Discovery** — Search, filter, browse skills theo category, rating, popularity
- **Version Management** — Semantic versioning, update notifications, rollback
- **Community Features** — Ratings, reviews, usage stats, featured skills
- **CLI Commands** — `xclaw hub search`, `xclaw hub install`, `xclaw hub publish`, `xclaw hub import`
- **Web UI** — SkillHub marketplace page trong xClaw web dashboard

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| SkillHub | Marketplace/Registry trung tâm cho xClaw skills |
| Skill | Plugin module trong xClaw với manifest + tools + lifecycle |
| SKILL.md | Anthropic's skill definition format (YAML frontmatter + instructions) |
| SkillManifest | xClaw's skill metadata schema (id, name, version, tools, config...) |
| MCP | Model Context Protocol — chuẩn kết nối AI models với external tools |
| SkillPack | Bundle nhiều skills liên quan (ví dụ: "Web Development Pack") |
| Skill Adapter | Module convert skill format từ bên ngoài sang xClaw format |
| Skill Review | Process duyệt skill trước khi publish lên marketplace |
| Featured Skill | Skill được xClaw team chọn đề xuất cho community |

### 1.4 References

- xClaw Architecture Document ([docs/architecture/overview.md](../architecture/overview.md))
- xClaw Skill Development Guide ([docs/skills/creating-skills.md](../skills/creating-skills.md))
- xClaw Agent Hub Overview ([docs/agent-hub/overview.md](../agent-hub/overview.md))
- [Anthropic Skills Repository](https://github.com/anthropics/skills) — Official Anthropic skill definitions
- [Anthropic Skills Guide](https://resources.anthropic.com) — The Complete Guide to Building Skills for Claude
- [MCP Specification](https://spec.modelcontextprotocol.io/) — Model Context Protocol standard
- [npm Registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)

---

## 2. Overall Description

### 2.1 Product Perspective — SkillHub Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        xClaw Platform                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │   Web UI      │  │   CLI        │  │   REST API            │  │
│  │  SkillHub     │  │  xclaw hub   │  │   /api/hub/*          │  │
│  │  Marketplace  │  │  commands    │  │                       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                 │                       │              │
│  ┌──────▼─────────────────▼───────────────────────▼───────────┐  │
│  │                   SkillHub Service                         │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │  │
│  │  │  Registry     │ │  Discovery   │ │  Submission        │  │  │
│  │  │  Manager      │ │  Engine      │ │  Pipeline          │  │  │
│  │  └──────────────┘ └──────────────┘ └────────────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │  │
│  │  │  Version      │ │  Community   │ │  Security          │  │  │
│  │  │  Manager      │ │  (Ratings)   │ │  Scanner           │  │  │
│  │  └──────────────┘ └──────────────┘ └────────────────────┘  │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │                   Skill Adapters                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │  │
│  │  │  Anthropic    │ │  MCP Server  │ │  npm Package       │  │  │
│  │  │  Adapter      │ │  Adapter     │ │  Adapter           │  │  │
│  │  └──────────────┘ └──────────────┘ └────────────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐                         │  │
│  │  │  GitHub Repo  │ │  Local File  │                         │  │
│  │  │  Adapter      │ │  Adapter     │                         │  │
│  │  └──────────────┘ └──────────────┘                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Existing xClaw Infrastructure                 │  │
│  │  SkillManager ←→ ToolRegistry ←→ Agent ←→ LLMRouter       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     External Sources          │
              │  • github.com/anthropics/skills│
              │  • npm registry               │
              │  • MCP server repos           │
              │  • Community GitHub repos      │
              │  • xClaw SkillHub API         │
              └───────────────────────────────┘
```

### 2.2 Product Functions

| Function | Description | Priority |
|----------|-------------|----------|
| **F-HUB-01** | Browse & search skills từ registry | P0 |
| **F-HUB-02** | Install skill từ SkillHub | P0 |
| **F-HUB-03** | Import skills từ Anthropic's repo | P0 |
| **F-HUB-04** | User tạo skill mới (scaffold) | P0 |
| **F-HUB-05** | Submit skill lên SkillHub | P1 |
| **F-HUB-06** | Review & merge workflow | P1 |
| **F-HUB-07** | Version management & updates | P1 |
| **F-HUB-08** | Ratings & reviews | P2 |
| **F-HUB-09** | Import MCP servers thành skills | P1 |
| **F-HUB-10** | Skill packs (bundles) | P2 |
| **F-HUB-11** | Security scanning trước khi publish | P1 |
| **F-HUB-12** | Usage analytics & trending | P2 |

### 2.3 User Classes

| User Class | Description | Key Functions |
|-----------|-------------|---------------|
| **Skill Consumer** | End user cài đặt & sử dụng skills | F-HUB-01, 02, 03, 08 |
| **Skill Developer** | Developer tạo & submit skills | F-HUB-04, 05, 07 |
| **Skill Reviewer** | Người duyệt submitted skills | F-HUB-06, 11 |
| **Platform Admin** | Quản lý SkillHub registry | Tất cả |

### 2.4 Constraints

- Skills phải follow xClaw SkillManifest schema
- Anthropic skills cần adapter convert SKILL.md → SkillManifest
- Security: Skills không được access filesystem/network ngoài sandbox trừ khi có explicit permission
- Backward compatibility: Phải tương thích với existing 12 built-in skills và Agent Hub UI

---

## 3. Functional Requirements

### 3.1 F-HUB-01: Skill Discovery & Search

**FR-01.1**: Hệ thống phải cung cấp API endpoint `GET /api/hub/skills` trả về danh sách skills trong registry

**FR-01.2**: Support filters:

- `category` — Filter theo SkillCategory (programming, healthcare, ...)
- `source` — Filter theo nguồn (built-in, anthropic, community, npm, mcp)
- `tags` — Filter theo tags
- `author` — Filter theo tác giả
- `rating` — Filter minimum rating (1-5)
- `sort` — Sort by: featured, popular, recent, rating, name
- `search` — Full-text search trong name, description, tags

**FR-01.3**: Mỗi skill listing phải hiển thị:

- Skill metadata (id, name, description, version, author)
- Category và tags
- Số tools
- Rating trung bình và số reviews
- Tổng lượt cài đặt
- Source badge (Built-in / Anthropic / Community / npm / MCP)
- Compatibility status (compatible, needs-update, incompatible)

**FR-01.4**: Pagination với `page` và `limit` parameters

### 3.2 F-HUB-02: Skill Installation

**FR-02.1**: Install từ SkillHub registry:

```
POST /api/hub/skills/:id/install
```

**FR-02.2**: Install từ nhiều sources:

- **SkillHub Registry** — `xclaw hub install <skill-id>`
- **npm package** — `xclaw hub install --npm @xclaw/skill-analytics`
- **GitHub URL** — `xclaw hub install --git https://github.com/user/xclaw-skill-xxx`
- **Local file** — `xclaw hub install --file ./my-skill.tar.gz`

**FR-02.3**: Dependency resolution — Tự động cài đặt dependencies nếu skill khai báo trong `dependencies` field

**FR-02.4**: Post-install hook — Tự động run `activate()` nếu skill không cần config bắt buộc

**FR-02.5**: Rollback — Nếu install fail, rollback về trạng thái trước đó

### 3.3 F-HUB-03: Anthropic Skill Import

**FR-03.1**: Fetch danh sách skills từ `github.com/anthropics/skills` repository

**FR-03.2**: Parse SKILL.md format:

```yaml
---
name: skill-name-in-kebab-case
description: What it does and when to use it
allowed-tools: [optional list of MCP tools]
---
# Instructions
Step-by-step guidance for Claude
## Examples
Concrete usage scenarios
```

**FR-03.3**: Convert thành xClaw SkillManifest:

- `name` → `id` (kebab-case → underscore)
- `description` → `description`
- `allowed-tools` → Parse thành `ToolDefinition[]` (bridge tools)
- Instructions → Inject vào system prompt khi skill active
- Version → Auto-assign `1.0.0` + commit SHA suffix

**FR-03.4**: Anthropic skill chạy dưới dạng **Prompt-Based Skill**:

- Không có executable tools (chỉ có instructions)
- Khi activate, inject SKILL.md content vào system prompt
- Hoặc wrap thành tool gọi Claude API nếu skill cần specific model

**FR-03.5**: CLI command:

```bash
xclaw hub import anthropic                    # List available skills
xclaw hub import anthropic --skill deploy     # Import specific skill
xclaw hub import anthropic --all              # Import all skills
```

**FR-03.6**: Sync mechanism — Kiểm tra updates từ Anthropic repo, notify user khi có phiên bản mới

### 3.4 F-HUB-04: User Skill Creation

**FR-04.1**: Scaffold command tạo skill mới:

```bash
xclaw hub create my-awesome-skill
```

Generates:

```
skills/my-awesome-skill/
├── package.json
├── tsconfig.json
├── xclaw.plugin.json
├── SKILL.md                   # Compatible with Anthropic format
├── README.md
├── src/
│   ├── index.ts               # defineSkill() boilerplate
│   └── tools/
│       └── example-tool.ts
└── tests/
    └── example-tool.test.ts
```

**FR-04.2**: Interactive wizard:

```
? Skill name: my-awesome-skill
? Display name: My Awesome Skill
? Description: Does amazing things
? Category: (select from list)
? Tags: (comma-separated)
? Author: User Name <user@email.com>
? Include example tool? Yes
? Include Anthropic SKILL.md? Yes
? Include tests? Yes
```

**FR-04.3**: Validate skill trước khi hoàn thành scaffold:

- Kiểm tra id uniqueness trong local registry
- Validate manifest schema
- TypeScript compilation check

### 3.5 F-HUB-05: Skill Submission Pipeline

**FR-05.1**: Submit command:

```bash
xclaw hub publish                    # Publish to xClaw SkillHub
xclaw hub publish --npm              # Also publish to npm
```

**FR-05.2**: Pre-publish checks:

- Manifest validation (required fields)
- TypeScript type checking
- Security scan (no malicious dependencies, no network calls không khai báo)
- Tool definition validation
- README.md exists
- CHANGELOG.md exists (for updates)

**FR-05.3**: Tạo submission package:

- Bundle source code
- Include manifest, README, CHANGELOG
- Generate checksum (SHA-256)
- Upload to SkillHub API

**FR-05.4**: GitHub PR workflow (cho open-source skills):

- `xclaw hub submit --github` → Fork xClaw skills repo, tạo PR
- PR template auto-generated với skill metadata
- CI/CD checks chạy tự động

### 3.6 F-HUB-06: Review & Merge

**FR-06.1**: Review dashboard cho reviewers:

- Pending submissions queue
- Skill preview (manifest, code, tools)
- Security scan results
- One-click approve/reject

**FR-06.2**: Auto-review cho low-risk skills:

- No filesystem permissions
- No shell permissions
- No network permissions
- < 500 lines of code
- All dependencies trusted (allowlisted)

**FR-06.3**: Merge to registry:

- Approved skills published to SkillHub registry
- Version bump validation
- CDN distribution cho fast install

### 3.7 F-HUB-07: Version Management

**FR-07.1**: Semantic versioning enforcement (major.minor.patch)

**FR-07.2**: Update check:

```bash
xclaw hub update-check              # Check for updates
xclaw hub update <skill-id>         # Update specific skill
xclaw hub update --all              # Update all skills
```

**FR-07.3**: Changelog display khi update available

**FR-07.4**: Breaking change detection — Warn khi major version change

### 3.8 F-HUB-09: MCP Server Adapter

**FR-09.1**: Import MCP server và wrap thành xClaw skill:

```bash
xclaw hub import mcp @modelcontextprotocol/server-github
xclaw hub import mcp @anthropic/mcp-server-filesystem
```

**FR-09.2**: MCP → xClaw tool mapping:

- MCP `Tool` → xClaw `ToolDefinition`
- MCP `inputSchema` → xClaw `ToolParameter[]`
- MCP `Resource` → Knowledge injection
- MCP `Prompt` → System prompt enhancement

**FR-09.3**: Runtime bridge:

- Spawn MCP server process khi skill activate
- Route xClaw tool calls → MCP server via stdio/SSE
- Kill process khi skill deactivate

---

## 4. Non-Functional Requirements

### 4.1 Performance

- **NFR-01**: Skill listing API phải trả về < 200ms cho registry < 10,000 skills
- **NFR-02**: Skill install từ registry < 10s (excluding download time)
- **NFR-03**: Anthropic skill import (parse + convert) < 2s per skill

### 4.2 Security

- **NFR-04**: Tất cả skill code phải qua security scan trước khi publish
- **NFR-05**: Skills chạy trong sandbox, không access host filesystem trừ khi có explicit permission
- **NFR-06**: Plugin manifest checksum verification khi install
- **NFR-07**: Không execute arbitrary code trong SKILL.md parsing

### 4.3 Compatibility

- **NFR-08**: Backward compatible với existing `defineSkill()` API
- **NFR-09**: Anthropic SKILL.md skills phải hoạt động với mọi LLM provider (không chỉ Claude)
- **NFR-10**: MCP server adapter phải support cả stdio và SSE transport

### 4.4 Usability

- **NFR-11**: CLI commands phải có `--help` với examples
- **NFR-12**: Web UI marketplace phải responsive (mobile-friendly)
- **NFR-13**: Skill creation wizard phải hoàn tất < 2 phút

---

## 5. Data Model

### 5.1 SkillHub Registry Entry

```typescript
interface HubSkillEntry {
  // Identity
  id: string;                      // Unique: 'anthropic/deploy', 'community/seo-optimizer'
  name: string;                    // Display name
  slug: string;                    // URL-friendly slug
  
  // Metadata
  version: string;                 // Semantic version
  description: string;
  longDescription?: string;        // Markdown
  author: HubAuthor;
  license: string;
  
  // Classification
  category: SkillCategory;
  tags: string[];
  source: SkillSource;             // 'built-in' | 'anthropic' | 'community' | 'npm' | 'mcp'
  
  // Content
  manifest: SkillManifest;
  readme?: string;                 // README.md content
  changelog?: string;              // CHANGELOG.md content
  skillMd?: string;                // Anthropic SKILL.md content (nếu có)
  
  // Statistics
  stats: HubSkillStats;
  
  // Distribution
  distribution: HubDistribution;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

interface HubAuthor {
  name: string;
  email?: string;
  url?: string;
  avatar?: string;
  verified: boolean;              // Verified publisher
}

interface HubSkillStats {
  installs: number;
  activeInstalls: number;
  rating: number;                 // 1-5
  reviewCount: number;
  weeklyDownloads: number;
  toolCallsTotal: number;        // Aggregated across all instances
}

interface HubDistribution {
  type: 'registry' | 'npm' | 'git' | 'file';
  url?: string;                  // npm package, git URL, or registry download URL
  checksum?: string;             // SHA-256
  size?: number;                 // bytes
  tarball?: string;              // Direct download URL
}

type SkillSource = 'built-in' | 'anthropic' | 'community' | 'npm' | 'mcp' | 'partner';
```

### 5.2 Anthropic Skill (parsed SKILL.md)

```typescript
interface AnthropicSkill {
  // From YAML frontmatter
  name: string;                    // kebab-case
  description: string;
  allowedTools?: string[];         // MCP tool names
  
  // From markdown body
  instructions: string;            // Full markdown instructions
  examples?: string;               // Examples section
  
  // Computed
  sourceCommitSha: string;         // Git commit hash for versioning
  sourceRepoUrl: string;           // Repository URL
  folderPath: string;              // Path within repo
}
```

### 5.3 Skill Review

```typescript
interface SkillReview {
  id: string;
  skillId: string;
  userId: string;
  rating: number;                  // 1-5
  title: string;
  body: string;
  createdAt: string;
  helpful: number;                 // Upvotes
}

interface SkillSubmission {
  id: string;
  skillId: string;
  version: string;
  submittedBy: HubAuthor;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'needs-changes';
  reviewNotes?: string;
  securityScanResult?: SecurityScanResult;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

interface SecurityScanResult {
  passed: boolean;
  score: number;                   // 0-100
  issues: SecurityIssue[];
}

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;                    // 'malicious-dep', 'unsafe-code', 'network-access'
  message: string;
  file?: string;
  line?: number;
}
```

---

## 6. API Design

### 6.1 REST API Endpoints

```
# ─── SkillHub Discovery ───────────────────────────────
GET    /api/hub/skills                    # List/search skills
GET    /api/hub/skills/:id                # Get skill detail
GET    /api/hub/skills/:id/readme         # Get README
GET    /api/hub/skills/:id/changelog      # Get changelog
GET    /api/hub/skills/:id/reviews        # Get reviews

# ─── SkillHub Installation ────────────────────────────
POST   /api/hub/skills/:id/install        # Install from registry
POST   /api/hub/install                   # Install from URL/npm/file
DELETE /api/hub/skills/:id/uninstall      # Uninstall

# ─── Anthropic Import ─────────────────────────────────
GET    /api/hub/import/anthropic          # List available Anthropic skills
POST   /api/hub/import/anthropic/:name    # Import specific skill
POST   /api/hub/import/anthropic/sync     # Sync all from Anthropic

# ─── MCP Import ───────────────────────────────────────
POST   /api/hub/import/mcp               # Import MCP server as skill

# ─── Skill Submission ─────────────────────────────────
POST   /api/hub/submit                    # Submit skill for review
GET    /api/hub/submissions               # List submissions (reviewer)
PATCH  /api/hub/submissions/:id           # Review action (approve/reject)

# ─── Community ────────────────────────────────────────
POST   /api/hub/skills/:id/reviews        # Add review
GET    /api/hub/featured                  # Get featured skills
GET    /api/hub/trending                  # Get trending skills
GET    /api/hub/stats                     # Hub statistics

# ─── Updates ──────────────────────────────────────────
GET    /api/hub/updates                   # Check for updates
POST   /api/hub/skills/:id/update         # Update skill
```

### 6.2 CLI Commands

```bash
# ─── Discovery ────────────────────────────────────────
xclaw hub search [query]                  # Search skills
xclaw hub list                            # List all available
xclaw hub info <skill-id>                 # Show skill details

# ─── Installation ─────────────────────────────────────
xclaw hub install <skill-id>              # Install from registry
xclaw hub install --npm <package>         # Install from npm
xclaw hub install --git <url>             # Install from git
xclaw hub install --file <path>           # Install from file
xclaw hub uninstall <skill-id>            # Uninstall
xclaw hub update [skill-id]              # Update skill(s)

# ─── Import ───────────────────────────────────────────
xclaw hub import anthropic                # List Anthropic skills
xclaw hub import anthropic <name>         # Import specific
xclaw hub import anthropic --all          # Import all
xclaw hub import mcp <package>            # Import MCP server

# ─── Skill Creation ──────────────────────────────────
xclaw hub create <name>                   # Scaffold new skill
xclaw hub validate                        # Validate current skill
xclaw hub test                            # Run skill tests
xclaw hub publish                         # Publish to SkillHub
xclaw hub submit --github                 # Submit via GitHub PR
```

---

## 7. UI Wireframes

### 7.1 SkillHub Marketplace Page

```
┌─────────────────────────────────────────────────────────────────┐
│  🏪 SkillHub Marketplace                          [+ Create]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔍 Search skills...                    [Filter ▼]       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [All] [Anthropic] [Community] [npm] [MCP]    Sort: Featured ▼  │
│                                                                 │
│  ── Featured ──────────────────────────────────────────────────  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ ⭐ Deploy │ │ 🔧 Code  │ │ 📊 Data  │ │ 🎨 UI    │          │
│  │ Review    │ │ Quality  │ │ Pipeline │ │ Design   │          │
│  │ ────────  │ │ ────────  │ │ ────────  │ │ ────────  │          │
│  │ v1.2.0    │ │ v2.0.1   │ │ v1.0.0   │ │ v1.5.0   │          │
│  │ ★★★★★     │ │ ★★★★☆    │ │ ★★★★☆    │ │ ★★★★★    │          │
│  │ 1.2k ↓    │ │ 890 ↓    │ │ 650 ↓    │ │ 1.5k ↓   │          │
│  │ [Anthropic]│ │ [Community]│ │ [npm]    │ │ [Anthropic]│         │
│  │ [Install]  │ │ [Install]  │ │ [Install] │ │ [Install]  │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  ── All Skills ────────────────────────────────────────────────  │
│  Programming | Healthcare | DevOps | Content | Research | ...   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📦 anthropic/deploy        v1.0.0  ★★★★★  1.2k ↓       │  │
│  │  Deploy to production following release process           │  │
│  │  [Anthropic] [devops] [ci-cd]              [Install]      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  📦 community/seo-optimizer  v2.1.0  ★★★★☆  340 ↓       │  │
│  │  Optimize content for search engines with AI              │  │
│  │  [Community] [marketing] [seo]             [Install]      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  📦 mcp/github-tools         v1.0.0  ★★★★★  890 ↓       │  │
│  │  GitHub integration via MCP (issues, PRs, repos)          │  │
│  │  [MCP] [programming] [git]                 [Install]      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [← Prev]  Page 1 of 12  [Next →]                              │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Skill Detail Page

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to SkillHub                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📦 anthropic/deploy                         [Install]   │    │
│  │  Deploy to production following our release process       │    │
│  │                                                           │    │
│  │  v1.0.0 | By Anthropic ✓ | ★★★★★ (42 reviews)           │    │
│  │  [Anthropic] [devops] [ci-cd] [deployment]               │    │
│  │  1,234 installs | 890 active | Updated 2 days ago        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Overview] [Tools (3)] [Reviews (42)] [Changelog]              │
│                                                                 │
│  ## Overview                                                    │
│  This skill provides deployment automation following            │
│  industry best practices...                                     │
│                                                                 │
│  ## Tools                                                       │
│  | Tool | Description |                                         │
│  |------|-------------|                                         │
│  | deploy_staging | Deploy to staging environment |              │
│  | deploy_production | Deploy to production |                    │
│  | rollback | Rollback to previous version |                     │
│                                                                 │
│  ## Source                                                       │
│  Imported from: github.com/anthropics/skills/deploy             │
│  Original SKILL.md: [View] [Raw]                                │
│                                                                 │
│  ## Compatibility                                               │
│  ✅ xClaw v0.1.0+  ✅ All LLM providers  ✅ No special deps    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Plan

### Phase 1 — Foundation (Week 1-2)

1. SkillHub types trong `@xclaw/shared`
2. SkillHub Service core (registry, local JSON store)
3. Anthropic Skill Adapter (SKILL.md parser + converter)
4. CLI commands: `hub search`, `hub install`, `hub import anthropic`
5. REST API endpoints (discovery, install, import)

### Phase 2 — User Creation & Submission (Week 3-4)

6. Skill scaffold command (`hub create`)
2. Skill validation & testing
3. Submission pipeline (local → review → publish)
4. Security scanner (basic)
5. CLI commands: `hub create`, `hub publish`, `hub validate`

### Phase 3 — Web UI & Community (Week 5-6)

11. SkillHub marketplace page (Web)
2. Skill detail page
3. Ratings & reviews UI
4. Update management UI
5. MCP server adapter

### Phase 4 — Polish (Week 7-8)

16. Featured skills curation
2. Trending algorithm
3. Analytics dashboard
4. Documentation
5. End-to-end testing
