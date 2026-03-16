import type { SkillManifest } from '@autox/shared';

export const modelManagementManifest: SkillManifest = {
  id: 'model-management',
  name: 'Model Management',
  version: '3.0.0',
  description: 'Full model lifecycle management with MCP server integration and RAG knowledge base',
  author: 'AutoX',
  category: 'custom',
  tags: ['models', 'llm', 'ollama', 'mcp', 'rag', 'knowledge'],
  tools: [
    // ── Model CRUD (4) ────────────────────────────────────
    {
      name: 'model_list',
      description: 'List all model profiles with optional filtering by provider or status',
      category: 'model-management',
      parameters: [
        { name: 'provider', type: 'string', description: 'Filter by provider (ollama, openai, anthropic, google, custom)', required: false },
        { name: 'status', type: 'string', description: 'Filter by status (available, unavailable, error, pulling)', required: false },
      ],
      returns: { name: 'models', type: 'array', description: 'Array of model profiles' },
    },
    {
      name: 'model_create',
      description: 'Create a new LLM model profile',
      category: 'model-management',
      parameters: [
        { name: 'name', type: 'string', description: 'Display name for the model', required: true },
        { name: 'provider', type: 'string', description: 'LLM provider', required: true },
        { name: 'modelId', type: 'string', description: 'Provider model identifier', required: true },
        { name: 'apiKey', type: 'string', description: 'API key (will be encrypted)', required: false },
        { name: 'baseUrl', type: 'string', description: 'Custom base URL', required: false },
        { name: 'temperature', type: 'number', description: 'Temperature (0-2)', required: false },
        { name: 'maxTokens', type: 'number', description: 'Max tokens', required: false },
      ],
      returns: { name: 'model', type: 'object', description: 'Created model profile' },
    },
    {
      name: 'model_update',
      description: 'Update an existing model profile',
      category: 'model-management',
      parameters: [
        { name: 'id', type: 'string', description: 'Model profile UUID', required: true },
        { name: 'name', type: 'string', description: 'New name', required: false },
        { name: 'baseUrl', type: 'string', description: 'New base URL', required: false },
        { name: 'temperature', type: 'number', description: 'New temperature', required: false },
        { name: 'maxTokens', type: 'number', description: 'New max tokens', required: false },
        { name: 'tags', type: 'array', description: 'Tags', required: false },
        { name: 'notes', type: 'string', description: 'Notes', required: false },
      ],
      returns: { name: 'result', type: 'object', description: 'Updated model' },
    },
    {
      name: 'model_delete',
      description: 'Soft delete a model profile',
      category: 'model-management',
      parameters: [
        { name: 'id', type: 'string', description: 'Model profile UUID', required: true },
      ],
      returns: { name: 'result', type: 'object', description: '{ id, deletedAt }' },
    },

    // ── Model Operations (4) ──────────────────────────────
    {
      name: 'model_switch',
      description: 'Switch active model globally or per-session',
      category: 'model-management',
      parameters: [
        { name: 'modelId', type: 'string', description: 'Model profile UUID to switch to', required: true },
        { name: 'scope', type: 'string', description: 'default or session', required: false },
      ],
      returns: { name: 'result', type: 'object', description: '{ previousModel, activeModel, scope }' },
    },
    {
      name: 'model_get_active',
      description: 'Get currently active model',
      category: 'model-management',
      parameters: [],
      returns: { name: 'result', type: 'object', description: '{ model, scope, since }' },
    },
    {
      name: 'model_benchmark',
      description: 'Run benchmark tests on a model',
      category: 'model-management',
      parameters: [
        { name: 'modelId', type: 'string', description: 'Model profile UUID', required: true },
        { name: 'tests', type: 'array', description: 'Test types: speed, code, tool_calling, vietnamese, context_length', required: false },
      ],
      returns: { name: 'result', type: 'object', description: 'Benchmark results' },
    },
    {
      name: 'model_test_connection',
      description: 'Test connectivity to LLM provider',
      category: 'model-management',
      parameters: [
        { name: 'modelId', type: 'string', description: 'Model profile UUID', required: true },
      ],
      returns: { name: 'result', type: 'object', description: '{ reachable, latencyMs, tokensPerSecond }' },
    },

    // ── Ollama (3) ────────────────────────────────────────
    {
      name: 'ollama_list',
      description: 'List all models available in local Ollama',
      category: 'model-management',
      parameters: [],
      returns: { name: 'models', type: 'array', description: 'Ollama model list' },
    },
    {
      name: 'ollama_pull',
      description: 'Pull a model from Ollama registry and optionally create model profile',
      category: 'model-management',
      parameters: [
        { name: 'name', type: 'string', description: 'Model name (e.g., qwen2.5:3b)', required: true },
        { name: 'autoRegister', type: 'boolean', description: 'Auto-create model profile', required: false },
      ],
      returns: { name: 'result', type: 'object', description: '{ taskId, message }' },
    },
    {
      name: 'ollama_remove',
      description: 'Delete a model from Ollama storage',
      category: 'model-management',
      parameters: [
        { name: 'name', type: 'string', description: 'Model name', required: true },
      ],
      returns: { name: 'result', type: 'object', description: '{ name, removed }' },
    },

    // ── Health Check (1) ──────────────────────────────────
    {
      name: 'provider_health_check',
      description: 'Check health of all providers and databases',
      category: 'model-management',
      parameters: [],
      returns: { name: 'result', type: 'object', description: 'Health status of all providers and databases' },
    },

    // ── MCP (4) ───────────────────────────────────────────
    {
      name: 'mcp_register',
      description: 'Register a new MCP server',
      category: 'model-management',
      parameters: [
        { name: 'name', type: 'string', description: 'Server name', required: true },
        { name: 'domain', type: 'string', description: 'Domain: code, web, data, productivity, knowledge, devops, media, custom', required: true },
        { name: 'transport', type: 'string', description: 'Transport: stdio, sse, streamable-http', required: true },
        { name: 'command', type: 'string', description: 'Command for stdio transport', required: false },
        { name: 'url', type: 'string', description: 'URL for sse/http transport', required: false },
        { name: 'env', type: 'object', description: 'Environment variables (will be encrypted)', required: false },
      ],
      returns: { name: 'result', type: 'object', description: 'Registered server config' },
    },
    {
      name: 'mcp_list',
      description: 'List all registered MCP servers grouped by domain',
      category: 'model-management',
      parameters: [
        { name: 'domain', type: 'string', description: 'Filter by domain', required: false },
        { name: 'status', type: 'string', description: 'Filter by status', required: false },
      ],
      returns: { name: 'result', type: 'object', description: '{ servers, byDomain }' },
    },
    {
      name: 'mcp_toggle',
      description: 'Enable or disable an MCP server',
      category: 'model-management',
      parameters: [
        { name: 'serverId', type: 'string', description: 'Server UUID', required: true },
        { name: 'enabled', type: 'boolean', description: 'Enable or disable', required: true },
      ],
      returns: { name: 'result', type: 'object', description: '{ id, enabled, status }' },
    },
    {
      name: 'mcp_health',
      description: 'Check health of a specific MCP server',
      category: 'model-management',
      parameters: [
        { name: 'serverId', type: 'string', description: 'Server UUID', required: true },
      ],
      returns: { name: 'result', type: 'object', description: 'MCP health status' },
    },

    // ── Knowledge Base / RAG (6) ──────────────────────────
    {
      name: 'kb_create_collection',
      description: 'Create a new knowledge base collection',
      category: 'model-management',
      parameters: [
        { name: 'name', type: 'string', description: 'Collection name', required: true },
        { name: 'description', type: 'string', description: 'Description', required: false },
        { name: 'tags', type: 'array', description: 'Tags', required: false },
        { name: 'embeddingModel', type: 'string', description: 'Embedding model', required: false },
        { name: 'chunkStrategy', type: 'string', description: 'recursive, sentence, paragraph, fixed', required: false },
        { name: 'chunkMaxTokens', type: 'number', description: 'Max tokens per chunk', required: false },
      ],
      returns: { name: 'result', type: 'object', description: 'Created collection' },
    },
    {
      name: 'kb_add_document',
      description: 'Upload and ingest a document into knowledge base',
      category: 'model-management',
      parameters: [
        { name: 'collectionId', type: 'string', description: 'Collection ID', required: true },
        { name: 'name', type: 'string', description: 'Document name', required: true },
        { name: 'content', type: 'string', description: 'Document content (text/markdown)', required: true },
        { name: 'mimeType', type: 'string', description: 'MIME type', required: false },
      ],
      returns: { name: 'result', type: 'object', description: '{ documentId, chunkCount, status }' },
    },
    {
      name: 'kb_search',
      description: 'Semantic search in knowledge base',
      category: 'model-management',
      parameters: [
        { name: 'collectionId', type: 'string', description: 'Collection ID', required: true },
        { name: 'query', type: 'string', description: 'Search query', required: true },
        { name: 'topK', type: 'number', description: 'Max results', required: false },
        { name: 'scoreThreshold', type: 'number', description: 'Min similarity score', required: false },
      ],
      returns: { name: 'results', type: 'array', description: 'Matched chunks with scores' },
    },
    {
      name: 'kb_list_collections',
      description: 'List all knowledge collections',
      category: 'model-management',
      parameters: [
        { name: 'tags', type: 'array', description: 'Filter by tags', required: false },
      ],
      returns: { name: 'collections', type: 'array', description: 'Array of collections' },
    },
    {
      name: 'kb_list_documents',
      description: 'List all documents in a knowledge collection',
      category: 'model-management',
      parameters: [
        { name: 'collection_id', type: 'string', description: 'Collection ID', required: true },
      ],
      returns: { name: 'documents', type: 'array', description: 'Array of documents' },
    },
    {
      name: 'kb_delete_collection',
      description: 'Delete an entire knowledge collection and all its documents/chunks',
      category: 'model-management',
      parameters: [
        { name: 'collectionId', type: 'string', description: 'Collection ID', required: true },
      ],
      returns: { name: 'result', type: 'object', description: '{ collectionId, deleted }' },
    },
    {
      name: 'kb_delete_document',
      description: 'Remove a document and its chunks from a collection',
      category: 'model-management',
      parameters: [
        { name: 'documentId', type: 'string', description: 'Document ID', required: true },
      ],
      returns: { name: 'result', type: 'object', description: '{ documentId, deleted }' },
    },
  ],
  config: [
    { key: 'pgConnectionString', label: 'PostgreSQL Connection', type: 'string', description: 'PostgreSQL connection string', required: true },
    { key: 'mongoConnectionString', label: 'MongoDB Connection', type: 'string', description: 'MongoDB connection string', required: true },
    { key: 'encryptionKey', label: 'Encryption Key', type: 'secret', description: 'AES-256 encryption key (hex)', required: true },
    { key: 'ollamaBaseUrl', label: 'Ollama URL', type: 'string', description: 'Ollama base URL', required: false },
  ],
};
