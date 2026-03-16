import type { Db } from 'mongodb';

export async function setupMongoIndexes(db: Db): Promise<void> {
  // conversations
  await db.collection('conversations').createIndexes([
    { key: { conversationId: 1 }, unique: true },
    { key: { modelProfileId: 1, lastMessageAt: -1 } },
    { key: { createdAt: -1 } },
    { key: { tags: 1 } },
    { key: { deletedAt: 1 }, partialFilterExpression: { deletedAt: null } },
  ]);

  // memory_entries
  await db.collection('memory_entries').createIndexes([
    { key: { type: 1, createdAt: -1 } },
    { key: { 'metadata.tags': 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]);

  // llm_responses
  await db.collection('llm_responses').createIndexes([
    { key: { modelProfileId: 1, createdAt: -1 } },
    { key: { conversationId: 1 } },
    { key: { statusCode: 1 }, partialFilterExpression: { statusCode: { $gt: 200 } } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]);

  // knowledge_collections
  await db.collection('knowledge_collections').createIndexes([
    { key: { collectionId: 1 }, unique: true },
    { key: { name: 1 }, unique: true },
    { key: { tags: 1 } },
    { key: { deletedAt: 1 }, partialFilterExpression: { deletedAt: null } },
  ]);

  // knowledge_documents
  await db.collection('knowledge_documents').createIndexes([
    { key: { documentId: 1 }, unique: true },
    { key: { collectionId: 1, createdAt: -1 } },
    { key: { status: 1 } },
    { key: { contentHash: 1 } },
    { key: { deletedAt: 1 }, partialFilterExpression: { deletedAt: null } },
  ]);

  // knowledge_chunks
  await db.collection('knowledge_chunks').createIndexes([
    { key: { chunkId: 1 }, unique: true },
    { key: { documentId: 1, index: 1 } },
    { key: { collectionId: 1 } },
  ]);
}
