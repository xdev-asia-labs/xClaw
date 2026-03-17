// ============================================================
// SkillHub Store — Local JSON persistence for hub registry
// ============================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  HubSkillEntry,
  SkillReview,
  SkillSubmission,
  HubSearchParams,
  HubSearchResult,
} from '@xclaw/shared';

const DEFAULT_DATA_DIR = 'data';
const REGISTRY_FILE = 'skill-hub-registry.json';
const REVIEWS_FILE = 'skill-hub-reviews.json';
const SUBMISSIONS_FILE = 'skill-hub-submissions.json';

interface StoreData {
  skills: HubSkillEntry[];
  lastSynced?: string;
}

export class SkillHubStore {
  private dataDir: string;
  private skills: Map<string, HubSkillEntry> = new Map();
  private reviews: Map<string, SkillReview[]> = new Map();
  private submissions: SkillSubmission[] = [];
  private loaded = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? DEFAULT_DATA_DIR;
  }

  // ─── Initialization ──────────────────────────────────────

  async load(): Promise<void> {
    if (this.loaded) return;
    await mkdir(this.dataDir, { recursive: true });
    await this.loadRegistry();
    await this.loadReviews();
    await this.loadSubmissions();
    this.loaded = true;
  }

  private async loadRegistry(): Promise<void> {
    const filePath = join(this.dataDir, REGISTRY_FILE);
    if (!existsSync(filePath)) return;
    const raw = await readFile(filePath, 'utf-8');
    const data: StoreData = JSON.parse(raw);
    for (const skill of data.skills) {
      this.skills.set(skill.id, skill);
    }
  }

  private async loadReviews(): Promise<void> {
    const filePath = join(this.dataDir, REVIEWS_FILE);
    if (!existsSync(filePath)) return;
    const raw = await readFile(filePath, 'utf-8');
    const data: Record<string, SkillReview[]> = JSON.parse(raw);
    for (const [skillId, reviews] of Object.entries(data)) {
      this.reviews.set(skillId, reviews);
    }
  }

  private async loadSubmissions(): Promise<void> {
    const filePath = join(this.dataDir, SUBMISSIONS_FILE);
    if (!existsSync(filePath)) return;
    const raw = await readFile(filePath, 'utf-8');
    this.submissions = JSON.parse(raw);
  }

  // ─── Persistence ─────────────────────────────────────────

  private async saveRegistry(): Promise<void> {
    const filePath = join(this.dataDir, REGISTRY_FILE);
    const data: StoreData = {
      skills: [...this.skills.values()],
      lastSynced: new Date().toISOString(),
    };
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async saveReviews(): Promise<void> {
    const filePath = join(this.dataDir, REVIEWS_FILE);
    const data: Record<string, SkillReview[]> = {};
    for (const [skillId, reviews] of this.reviews) {
      data[skillId] = reviews;
    }
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async saveSubmissions(): Promise<void> {
    const filePath = join(this.dataDir, SUBMISSIONS_FILE);
    await writeFile(filePath, JSON.stringify(this.submissions, null, 2), 'utf-8');
  }

  // ─── Skill CRUD ──────────────────────────────────────────

  async addSkill(entry: HubSkillEntry): Promise<void> {
    this.skills.set(entry.id, entry);
    await this.saveRegistry();
  }

  async updateSkill(id: string, updates: Partial<HubSkillEntry>): Promise<HubSkillEntry | null> {
    const existing = this.skills.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.skills.set(id, updated);
    await this.saveRegistry();
    return updated;
  }

  async removeSkill(id: string): Promise<boolean> {
    const deleted = this.skills.delete(id);
    if (deleted) {
      this.reviews.delete(id);
      await this.saveRegistry();
      await this.saveReviews();
    }
    return deleted;
  }

  getSkill(id: string): HubSkillEntry | undefined {
    return this.skills.get(id);
  }

  getAllSkills(): HubSkillEntry[] {
    return [...this.skills.values()];
  }

  // ─── Search & Discovery ───────────────────────────────────

  search(params: HubSearchParams): HubSearchResult {
    let results = [...this.skills.values()];

    // Text search
    if (params.search) {
      const q = params.search.toLowerCase();
      results = results.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.id.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (params.category) {
      results = results.filter(s => s.category === params.category);
    }

    // Source filter
    if (params.source) {
      results = results.filter(s => s.source === params.source);
    }

    // Tags filter
    if (params.tags?.length) {
      results = results.filter(s =>
        params.tags!.some(t => s.tags.includes(t))
      );
    }

    // Author filter
    if (params.author) {
      results = results.filter(s =>
        s.author.name.toLowerCase().includes(params.author!.toLowerCase())
      );
    }

    // Rating filter
    if (params.minRating) {
      results = results.filter(s => s.stats.rating >= params.minRating!);
    }

    // Sort
    switch (params.sort) {
      case 'popular':
        results.sort((a, b) => b.stats.installs - a.stats.installs);
        break;
      case 'recent':
        results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case 'rating':
        results.sort((a, b) => b.stats.rating - a.stats.rating);
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'featured':
      default:
        results.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.stats.installs - a.stats.installs;
        });
    }

    // Pagination
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const start = (page - 1) * limit;
    const paged = results.slice(start, start + limit);

    return {
      skills: paged,
      total: results.length,
      page,
      limit,
      hasMore: start + limit < results.length,
    };
  }

  getFeatured(): HubSkillEntry[] {
    return [...this.skills.values()].filter(s => s.featured);
  }

  getTrending(): HubSkillEntry[] {
    return [...this.skills.values()]
      .sort((a, b) => b.stats.weeklyDownloads - a.stats.weeklyDownloads)
      .slice(0, 10);
  }

  getBySource(source: string): HubSkillEntry[] {
    return [...this.skills.values()].filter(s => s.source === source);
  }

  // ─── Reviews ─────────────────────────────────────────────

  async addReview(review: SkillReview): Promise<void> {
    const existing = this.reviews.get(review.skillId) ?? [];
    existing.push(review);
    this.reviews.set(review.skillId, existing);

    // Update skill rating
    const skill = this.skills.get(review.skillId);
    if (skill) {
      const avg = existing.reduce((sum, r) => sum + r.rating, 0) / existing.length;
      skill.stats.rating = Math.round(avg * 10) / 10;
      skill.stats.reviewCount = existing.length;
      await this.saveRegistry();
    }

    await this.saveReviews();
  }

  getReviews(skillId: string): SkillReview[] {
    return this.reviews.get(skillId) ?? [];
  }

  // ─── Submissions ─────────────────────────────────────────

  async addSubmission(submission: SkillSubmission): Promise<void> {
    this.submissions.push(submission);
    await this.saveSubmissions();
  }

  async updateSubmission(id: string, updates: Partial<SkillSubmission>): Promise<void> {
    const idx = this.submissions.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.submissions[idx] = { ...this.submissions[idx], ...updates };
    await this.saveSubmissions();
  }

  getSubmissions(status?: string): SkillSubmission[] {
    if (status) {
      return this.submissions.filter(s => s.status === status);
    }
    return [...this.submissions];
  }

  getSubmission(id: string): SkillSubmission | undefined {
    return this.submissions.find(s => s.id === id);
  }

  // ─── Stats ───────────────────────────────────────────────

  getHubStats(): { total: number; bySource: Record<string, number>; byCategory: Record<string, number> } {
    const skills = [...this.skills.values()];
    const bySource: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const s of skills) {
      bySource[s.source] = (bySource[s.source] ?? 0) + 1;
      byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
    }

    return { total: skills.length, bySource, byCategory };
  }

  async incrementInstalls(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (skill) {
      skill.stats.installs++;
      skill.stats.activeInstalls++;
      await this.saveRegistry();
    }
  }

  async decrementActiveInstalls(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (skill && skill.stats.activeInstalls > 0) {
      skill.stats.activeInstalls--;
      await this.saveRegistry();
    }
  }
}
