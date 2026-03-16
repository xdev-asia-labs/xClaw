import type { Db, Collection } from 'mongodb';
import type { ConversationDoc, ConversationMessageDoc } from '../../types/index.js';

export class ConversationRepository {
  private col: Collection<ConversationDoc>;

  constructor(db: Db) {
    this.col = db.collection<ConversationDoc>('conversations');
  }

  async create(data: { conversationId: string; title?: string; modelProfileId?: string; modelName?: string; provider?: string }): Promise<ConversationDoc> {
    const doc: ConversationDoc = {
      conversationId: data.conversationId,
      title: data.title,
      modelProfileId: data.modelProfileId,
      modelName: data.modelName,
      provider: data.provider,
      messages: [],
      messageCount: 0,
      totalTokens: 0,
      tags: [],
      createdAt: new Date(),
      lastMessageAt: new Date(),
    };
    await this.col.insertOne(doc);
    return doc;
  }

  async addMessage(conversationId: string, message: ConversationMessageDoc): Promise<void> {
    const tokens = (message.usage?.promptTokens ?? 0) + (message.usage?.completionTokens ?? 0);
    await this.col.updateOne(
      { conversationId },
      {
        $push: { messages: message },
        $inc: { messageCount: 1, totalTokens: tokens },
        $set: { lastMessageAt: new Date() },
      },
    );
  }

  async getById(conversationId: string): Promise<ConversationDoc | null> {
    return this.col.findOne({ conversationId, deletedAt: { $exists: false } });
  }

  async list(limit = 20, skip = 0): Promise<ConversationDoc[]> {
    return this.col
      .find({ deletedAt: { $exists: false } }, { projection: { messages: 0 } })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async softDelete(conversationId: string): Promise<boolean> {
    const result = await this.col.updateOne(
      { conversationId },
      { $set: { deletedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    await this.col.updateOne({ conversationId }, { $set: { title } });
  }
}
