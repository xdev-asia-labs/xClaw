import type { SkillPlugin, SkillContext } from '@autox/core';
import type { Pool } from 'pg';
import type { MongoClient, Db } from 'mongodb';
import { modelManagementManifest } from './manifest.js';
import type { ModelManagementConfig } from './types/index.js';

// DB connections
import { createPgPool, runMigrations } from './repositories/pg/connection.js';
import { createMongoClient } from './repositories/mongo/connection.js';
import { setupMongoIndexes } from './repositories/mongo/setup-indexes.js';

// PG Repositories
import { ModelRepository } from './repositories/pg/model.repo.js';
import { BenchmarkRepository } from './repositories/pg/benchmark.repo.js';
import { UsageRepository } from './repositories/pg/usage.repo.js';
import { SessionRepository } from './repositories/pg/session.repo.js';
import { AuditRepository } from './repositories/pg/audit.repo.js';
import { MCPRepository } from './repositories/pg/mcp.repo.js';
import { RAGRepository } from './repositories/pg/rag.repo.js';

// Mongo Repositories
import { ConversationRepository } from './repositories/mongo/conversation.repo.js';
import { MemoryRepository } from './repositories/mongo/memory.repo.js';
import { ResponseRepository } from './repositories/mongo/response.repo.js';
import { TemplateRepository } from './repositories/mongo/template.repo.js';
import { KnowledgeRepository } from './repositories/mongo/knowledge.repo.js';

// Services
import { ModelService } from './services/model.service.js';
import { OllamaService } from './services/ollama.service.js';
import { BenchmarkService } from './services/benchmark.service.js';
import { UsageService } from './services/usage.service.js';
import { HealthService } from './services/health.service.js';
import { MCPService } from './services/mcp.service.js';
import { KnowledgeService } from './services/knowledge.service.js';
import { RAGService } from './services/rag.service.js';

// MCP
import { MCPClient } from './mcp/mcp-client.js';
import { MCPRegistry } from './mcp/mcp-registry.js';

// RAG
import { Embedder } from './rag/embedder.js';
import { VectorSearch } from './rag/vector-search.js';

// Tools
import { createModelCrudTools } from './tools/model-crud.tools.js';
import { createModelOpsTools } from './tools/model-ops.tools.js';
import { createOllamaTools } from './tools/ollama.tools.js';
import { createHealthTools } from './tools/health.tools.js';
import { createMCPTools } from './tools/mcp.tools.js';
import { createKnowledgeTools } from './tools/knowledge.tools.js';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let pgPool: Pool | null = null;
let mongoClient: MongoClient | null = null;
let mcpRegistry: MCPRegistry | null = null;
let ragService: RAGService | null = null;

export const modelManagementSkill: SkillPlugin = {
  manifest: modelManagementManifest,

  async activate(context: SkillContext) {
    const config = context.config as unknown as ModelManagementConfig;
    const log = context.log;

    log('Initializing Model Management skill...');

    // ── 1. Database connections ──────────────────────────
    pgPool = createPgPool(config.pgConnectionString);
    log('PostgreSQL pool created');

    const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'repositories', 'pg', 'migrations');
    await runMigrations(pgPool, migrationsDir);
    log('PostgreSQL migrations applied');

    mongoClient = createMongoClient(config.mongoConnectionString);
    await mongoClient.connect();
    const mongoDB: Db = mongoClient.db();
    await setupMongoIndexes(mongoDB);
    log('MongoDB connected + indexes created');

    // ── 2. Repositories ─────────────────────────────────
    const modelRepo = new ModelRepository(pgPool);
    const benchmarkRepo = new BenchmarkRepository(pgPool);
    const usageRepo = new UsageRepository(pgPool);
    const sessionRepo = new SessionRepository(pgPool);
    const auditRepo = new AuditRepository(pgPool);
    const mcpRepo = new MCPRepository(pgPool);
    const ragRepo = new RAGRepository(pgPool);

    const conversationRepo = new ConversationRepository(mongoDB);
    const memoryRepo = new MemoryRepository(mongoDB);
    const responseRepo = new ResponseRepository(mongoDB);
    const templateRepo = new TemplateRepository(mongoDB);
    const knowledgeRepo = new KnowledgeRepository(mongoDB);

    // ── 3. Services ─────────────────────────────────────
    const ollamaService = new OllamaService(config.ollamaBaseUrl);
    const modelService = new ModelService(modelRepo, config.encryptionKey);
    const benchmarkService = new BenchmarkService(benchmarkRepo, ollamaService, config.ollamaBaseUrl);
    const usageService = new UsageService(usageRepo);
    const healthService = new HealthService(pgPool, mongoDB, ollamaService);

    // MCP
    const mcpClient = new MCPClient();
    mcpRegistry = new MCPRegistry(mcpClient);
    const mcpService = new MCPService(mcpRepo, mcpRegistry, config.encryptionKey);

    // RAG
    const embedder = new Embedder(ollamaService);
    const vectorSearch = new VectorSearch(knowledgeRepo.getChunksCollection(), embedder);
    const knowledgeService = new KnowledgeService(knowledgeRepo, ragRepo, embedder);
    ragService = new RAGService(vectorSearch, ragRepo, knowledgeRepo);

    log('All services initialized');

    // ── 4. Register tools ───────────────────────────────
    const crudTools = createModelCrudTools(modelService);
    const opsTools = createModelOpsTools(modelService, benchmarkService);
    const ollamaTools = createOllamaTools(ollamaService, modelService);
    const healthTools = createHealthTools(healthService);
    const mcpTools = createMCPTools(mcpService);
    const knowledgeTools = createKnowledgeTools(knowledgeService, ragService);

    const allToolImpls: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
      ...crudTools,
      ...opsTools,
      ...ollamaTools,
      ...healthTools,
      ...mcpTools,
      ...knowledgeTools,
    };

    for (const toolDef of modelManagementManifest.tools) {
      const executor = allToolImpls[toolDef.name];
      if (executor) {
        context.toolRegistry.register(toolDef, executor);
        log(`Registered tool: ${toolDef.name}`);
      } else {
        log(`⚠ No implementation for tool: ${toolDef.name}`);
      }
    }

    // ── 5. Auto-connect MCP servers ─────────────────────
    await mcpService.connectAutoServers().catch(err => {
      log(`MCP auto-connect warning: ${err}`);
    });

    log(`✅ Model Management skill activated (${modelManagementManifest.tools.length} tools)`);
  },

  async deactivate() {
    // Disconnect MCP servers
    if (mcpRegistry) await mcpRegistry.disconnectAll().catch(() => {});

    // Close database connections
    if (pgPool) await pgPool.end().catch(() => {});
    if (mongoClient) await mongoClient.close().catch(() => {});

    pgPool = null;
    mongoClient = null;
    mcpRegistry = null;
    ragService = null;
  },
};

/** Get the RAG service for agent integration (RAG context injection) */
export function getRAGService(): RAGService | null {
  return ragService;
}
