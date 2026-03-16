import type { Db, Collection } from 'mongodb';

export interface PromptTemplateDoc {
  templateId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  variables: string[];
  tags: string[];
  modelPreference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateRepository {
  private col: Collection<PromptTemplateDoc>;

  constructor(db: Db) {
    this.col = db.collection<PromptTemplateDoc>('prompt_templates');
  }

  async create(data: Omit<PromptTemplateDoc, 'createdAt' | 'updatedAt'>): Promise<PromptTemplateDoc> {
    const doc: PromptTemplateDoc = { ...data, createdAt: new Date(), updatedAt: new Date() };
    await this.col.insertOne(doc);
    return doc;
  }

  async getById(templateId: string): Promise<PromptTemplateDoc | null> {
    return this.col.findOne({ templateId });
  }

  async list(limit = 50): Promise<PromptTemplateDoc[]> {
    return this.col.find().sort({ updatedAt: -1 }).limit(limit).toArray();
  }

  async update(templateId: string, data: Partial<PromptTemplateDoc>): Promise<boolean> {
    const result = await this.col.updateOne(
      { templateId },
      { $set: { ...data, updatedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  }

  async delete(templateId: string): Promise<boolean> {
    const result = await this.col.deleteOne({ templateId });
    return result.deletedCount > 0;
  }
}
