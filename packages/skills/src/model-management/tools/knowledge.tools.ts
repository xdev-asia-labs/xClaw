import type { KnowledgeService } from '../services/knowledge.service.js';
import type { RAGService } from '../services/rag.service.js';
import type { DocumentSource, ChunkStrategy } from '../types/index.js';

export function createKnowledgeTools(knowledgeService: KnowledgeService, ragService: RAGService) {
  return {
    kb_create_collection: async (args: Record<string, unknown>) => {
      const name = args.name as string;
      if (!name) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: name' }], isError: true };
      }

      const collection = await knowledgeService.createCollection({
        name,
        description: args.description as string | undefined,
        chunkStrategy: args.chunk_strategy as ChunkStrategy | undefined,
        maxTokens: args.max_tokens as number | undefined,
        overlap: args.overlap as number | undefined,
        tags: args.tags as string[] | undefined,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, collection }, null, 2) }] };
    },

    kb_add_document: async (args: Record<string, unknown>) => {
      const collectionId = args.collection_id as string;
      const source = args.source as DocumentSource;
      const input = args.input as string;
      if (!collectionId || !source || !input) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: collection_id, source, input' }], isError: true };
      }

      const document = await knowledgeService.addDocument(
        collectionId,
        source,
        input,
        args.name as string | undefined,
      );

      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, document }, null, 2) }] };
    },

    kb_search: async (args: Record<string, unknown>) => {
      const query = args.query as string;
      if (!query) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: query' }], isError: true };
      }

      const collectionIds = args.collection_ids as string[] | undefined;
      const topK = args.top_k as number | undefined;

      const results = await ragService.search(query, collectionIds, topK);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ total: results.length, results }, null, 2) }] };
    },

    kb_list_collections: async (_args: Record<string, unknown>) => {
      const collections = await knowledgeService.listCollections();
      return { content: [{ type: 'text' as const, text: JSON.stringify({ total: collections.length, collections }, null, 2) }] };
    },

    kb_delete_collection: async (args: Record<string, unknown>) => {
      const collectionId = args.collection_id as string;
      if (!collectionId) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: collection_id' }], isError: true };
      }

      await knowledgeService.deleteCollection(collectionId);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, collectionId, message: 'Collection deleted' }, null, 2) }] };
    },

    kb_delete_document: async (args: Record<string, unknown>) => {
      const collectionId = args.collection_id as string;
      const documentId = args.document_id as string;
      if (!collectionId || !documentId) {
        return { content: [{ type: 'text' as const, text: '❌ Missing required: collection_id, document_id' }], isError: true };
      }

      await knowledgeService.deleteDocument(collectionId, documentId);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, documentId, message: 'Document deleted' }, null, 2) }] };
    },
  };
}
