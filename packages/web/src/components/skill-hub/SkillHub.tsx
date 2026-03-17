// ============================================================
// SkillHub — Marketplace for browsing, importing & managing skills
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/utils/api';
import { Badge, Spinner, Modal } from '@/components/ui';
import {
  Search, Download, Trash2, Star, ExternalLink,
  Filter, Grid3X3, List, RefreshCw, Package, Upload,
  Globe, Cpu, Users, Sparkles, TrendingUp,
  ChevronRight, X, Check, AlertTriangle, Eye,
  Code2, HeartPulse, BarChart3, FileText, Palette,
  GitBranch, DollarSign, Briefcase, GraduationCap,
  Bot, Puzzle, Tag, Clock, ArrowUpCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface HubSkill {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: { name: string; email?: string; verified: boolean };
  license: string;
  source: 'community' | 'anthropic' | 'npm' | 'mcp' | 'builtin';
  category: string;
  tags: string[];
  stats: { downloads: number; rating: number; reviews: number; installs: number };
  featured?: boolean;
  installed?: boolean;
  readme?: string;
  createdAt: string;
  updatedAt: string;
}

interface AnthropicSkillInfo {
  name: string;
  description: string;
  folder: string;
  allowedTools: string[];
}

type SourceFilter = 'all' | 'anthropic' | 'community' | 'npm' | 'mcp';
type SortBy = 'featured' | 'popular' | 'recent' | 'rating' | 'name';
type ViewMode = 'grid' | 'list';
type TabView = 'browse' | 'anthropic' | 'submit' | 'updates';

const SOURCE_TABS: { id: SourceFilter; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All', icon: Grid3X3 },
  { id: 'anthropic', label: 'Anthropic', icon: Sparkles },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'npm', label: 'npm', icon: Package },
  { id: 'mcp', label: 'MCP', icon: Cpu },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  programming: Code2,
  healthcare: HeartPulse,
  analytics: BarChart3,
  content: FileText,
  design: Palette,
  devops: GitBranch,
  finance: DollarSign,
  'project-management': Briefcase,
  learning: GraduationCap,
  research: Globe,
  sales: DollarSign,
};

// ─── Main Component ─────────────────────────────────────────

export function SkillHub() {
  // State
  const [skills, setSkills] = useState<HubSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('featured');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [tabView, setTabView] = useState<TabView>('browse');
  const [selectedSkill, setSelectedSkill] = useState<HubSkill | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  // Anthropic tab
  const [anthropicSkills, setAnthropicSkills] = useState<AnthropicSkillInfo[]>([]);
  const [anthropicLoading, setAnthropicLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Updates tab
  const [updates, setUpdates] = useState<{ skillId: string; currentVersion: string; latestVersion?: string; hasUpdate: boolean }[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<{ total: number; bySource: Record<string, number>; byCategory: Record<string, number> } | null>(null);

  // Load skills
  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { sortBy };
      if (search) params.q = search;
      if (sourceFilter !== 'all') params.source = sourceFilter;
      const result = await api.hub.search(params);
      setSkills(result.skills ?? []);
    } catch {
      // offline / no hub data yet
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [search, sourceFilter, sortBy]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // Load stats once
  useEffect(() => {
    api.hub.getStats().then(setStats).catch(() => {});
  }, []);

  // Filtered list (client-side for responsiveness on top of server filter)
  const filtered = useMemo(() => {
    if (!search) return skills;
    const q = search.toLowerCase();
    return skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [skills, search]);

  // Handlers
  const handleInstall = async (id: string) => {
    setInstalling(id);
    try {
      await api.hub.installSkill(id);
      setSkills(prev => prev.map(s => s.id === id ? { ...s, installed: true } : s));
    } catch { /* ok */ }
    setInstalling(null);
  };

  const handleUninstall = async (id: string) => {
    setInstalling(id);
    try {
      await api.hub.uninstallSkill(id);
      setSkills(prev => prev.map(s => s.id === id ? { ...s, installed: false } : s));
    } catch { /* ok */ }
    setInstalling(null);
  };

  const handleImportAnthropic = async (name: string) => {
    setInstalling(name);
    try {
      await api.hub.importAnthropicSkill(name);
      await loadSkills();
    } catch { /* ok */ }
    setInstalling(null);
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await api.hub.syncAnthropicSkills();
      await loadSkills();
    } catch { /* ok */ }
    setSyncing(false);
  };

  const loadAnthropicSkills = async () => {
    setAnthropicLoading(true);
    try {
      const res = await api.hub.listAnthropicSkills();
      setAnthropicSkills(res.skills ?? []);
    } catch { setAnthropicSkills([]); }
    setAnthropicLoading(false);
  };

  const loadUpdates = async () => {
    setUpdatesLoading(true);
    try {
      const res = await api.hub.checkUpdates();
      setUpdates(res.updates ?? []);
    } catch { setUpdates([]); }
    setUpdatesLoading(false);
  };

  // Tab switch effects
  useEffect(() => {
    if (tabView === 'anthropic' && anthropicSkills.length === 0) loadAnthropicSkills();
    if (tabView === 'updates') loadUpdates();
  }, [tabView]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600/10 via-dark-900 to-emerald-600/10 border-b border-dark-700">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.12),transparent)]" />
        <div className="relative px-6 py-8 max-w-7xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
                <Puzzle size={22} className="text-violet-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Skill Hub</h1>
                <p className="text-xs text-slate-400">Browse, import & manage skills from community, Anthropic, npm & MCP</p>
              </div>
            </div>
            {/* Stats */}
            {stats && (
              <div className="flex items-center gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{stats.total}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
                </div>
                <div className="w-px h-8 bg-dark-700" />
                <div>
                  <div className="text-2xl font-bold text-violet-400">{stats.bySource?.anthropic ?? 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Anthropic</div>
                </div>
                <div className="w-px h-8 bg-dark-700" />
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{stats.bySource?.community ?? 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Community</div>
                </div>
              </div>
            )}
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 mt-5 mb-4">
            {([
              { id: 'browse', label: 'Browse', icon: Grid3X3 },
              { id: 'anthropic', label: 'Anthropic Import', icon: Sparkles },
              { id: 'updates', label: 'Updates', icon: ArrowUpCircle },
            ] as { id: TabView; label: string; icon: React.ElementType }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setTabView(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition font-medium ${
                  tabView === tab.id
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'text-slate-400 hover:bg-dark-800 hover:text-slate-200'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search + filters (browse tab only) */}
          {tabView === 'browse' && (
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search skills by name, description, or tag..."
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-800/80 border border-dark-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition backdrop-blur"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2.5 bg-dark-800/80 border border-dark-700 rounded-xl text-sm text-slate-300 cursor-pointer outline-none focus:border-violet-500"
              >
                <option value="featured">Featured</option>
                <option value="popular">Popular</option>
                <option value="recent">Recent</option>
                <option value="rating">Top Rated</option>
                <option value="name">Name</option>
              </select>
              <div className="flex items-center bg-dark-800 border border-dark-700 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition ${viewMode === 'grid' ? 'bg-violet-600/20 text-violet-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Grid3X3 size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition ${viewMode === 'list' ? 'bg-violet-600/20 text-violet-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Browse tab */}
        {tabView === 'browse' && (
          <>
            {/* Source filter pills */}
            <div className="flex items-center gap-2 mb-5">
              {SOURCE_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSourceFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    sourceFilter === tab.id
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                      : 'bg-dark-800 text-slate-400 border border-dark-700 hover:border-dark-600 hover:text-slate-300'
                  }`}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={loadSkills}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Loading / empty */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <Package size={48} className="mx-auto text-dark-600 mb-4" />
                <p className="text-slate-400">No skills found</p>
                <p className="text-xs text-slate-600 mt-1">Try a different search or import skills from Anthropic</p>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid view */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    installing={installing === skill.id}
                    onInstall={() => handleInstall(skill.id)}
                    onUninstall={() => handleUninstall(skill.id)}
                    onView={() => setSelectedSkill(skill)}
                  />
                ))}
              </div>
            ) : (
              /* List view */
              <div className="space-y-2">
                {filtered.map(skill => (
                  <SkillListItem
                    key={skill.id}
                    skill={skill}
                    installing={installing === skill.id}
                    onInstall={() => handleInstall(skill.id)}
                    onUninstall={() => handleUninstall(skill.id)}
                    onView={() => setSelectedSkill(skill)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Anthropic Import tab */}
        {tabView === 'anthropic' && (
          <AnthropicImportTab
            skills={anthropicSkills}
            loading={anthropicLoading}
            syncing={syncing}
            installing={installing}
            onImport={handleImportAnthropic}
            onSyncAll={handleSyncAll}
            onRefresh={loadAnthropicSkills}
          />
        )}

        {/* Updates tab */}
        {tabView === 'updates' && (
          <UpdatesTab
            updates={updates}
            loading={updatesLoading}
            onRefresh={loadUpdates}
          />
        )}
      </div>

      {/* Detail modal */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          installing={installing === selectedSkill.id}
          onClose={() => setSelectedSkill(null)}
          onInstall={() => handleInstall(selectedSkill.id)}
          onUninstall={() => handleUninstall(selectedSkill.id)}
        />
      )}
    </div>
  );
}

// ─── Skill Card (Grid) ─────────────────────────────────────

function SkillCard({ skill, installing, onInstall, onUninstall, onView }: {
  skill: HubSkill;
  installing: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onView: () => void;
}) {
  const CatIcon = CATEGORY_ICONS[skill.category] ?? Bot;
  const sourceColor = {
    anthropic: 'text-amber-400 bg-amber-500/10',
    community: 'text-emerald-400 bg-emerald-500/10',
    npm: 'text-red-400 bg-red-500/10',
    mcp: 'text-blue-400 bg-blue-500/10',
    builtin: 'text-slate-400 bg-slate-500/10',
  }[skill.source] ?? 'text-slate-400 bg-slate-500/10';

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sourceColor}`}>
            <CatIcon size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{skill.name}</h3>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>v{skill.version}</span>
              <span className="capitalize">{skill.source}</span>
            </div>
          </div>
        </div>
        {skill.featured && (
          <Star size={14} className="text-amber-400 fill-amber-400 flex-shrink-0" />
        )}
      </div>

      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{skill.description}</p>

      {/* Tags */}
      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {skill.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-dark-700 text-slate-500 rounded text-[10px]">
              {tag}
            </span>
          ))}
          {skill.tags.length > 3 && (
            <span className="text-[10px] text-slate-600">+{skill.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-3">
        <span className="flex items-center gap-1"><Download size={10} />{skill.stats.downloads}</span>
        <span className="flex items-center gap-1"><Star size={10} />{skill.stats.rating.toFixed(1)}</span>
        <span className="flex items-center gap-1"><Users size={10} />{skill.stats.installs}</span>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          onClick={onView}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-dark-600 text-slate-300 hover:bg-dark-700 transition"
        >
          <Eye size={12} className="inline mr-1" />Details
        </button>
        {skill.installed ? (
          <button
            onClick={onUninstall}
            disabled={installing}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            {installing ? <RefreshCw size={12} className="inline mr-1 animate-spin" /> : <Trash2 size={12} className="inline mr-1" />}
            Remove
          </button>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition disabled:opacity-50"
          >
            {installing ? <RefreshCw size={12} className="inline mr-1 animate-spin" /> : <Download size={12} className="inline mr-1" />}
            Install
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Skill List Item ────────────────────────────────────────

function SkillListItem({ skill, installing, onInstall, onUninstall, onView }: {
  skill: HubSkill;
  installing: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onView: () => void;
}) {
  const CatIcon = CATEGORY_ICONS[skill.category] ?? Bot;
  const sourceColor = {
    anthropic: 'text-amber-400',
    community: 'text-emerald-400',
    npm: 'text-red-400',
    mcp: 'text-blue-400',
    builtin: 'text-slate-400',
  }[skill.source] ?? 'text-slate-400';

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg hover:border-dark-600 transition cursor-pointer"
      onClick={onView}
    >
      <CatIcon size={18} className={sourceColor} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-white truncate">{skill.name}</span>
          <span className="text-[10px] text-slate-600">v{skill.version}</span>
          <Badge variant={skill.source === 'anthropic' ? 'warning' : 'default'}>
            {skill.source}
          </Badge>
          {skill.featured && <Star size={11} className="text-amber-400 fill-amber-400" />}
        </div>
        <p className="text-xs text-slate-500 truncate">{skill.description}</p>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-shrink-0">
        <span className="flex items-center gap-1"><Star size={10} />{skill.stats.rating.toFixed(1)}</span>
        <span className="flex items-center gap-1"><Download size={10} />{skill.stats.downloads}</span>
      </div>
      <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
        {skill.installed ? (
          <button
            onClick={onUninstall}
            disabled={installing}
            className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className="px-3 py-1.5 text-xs rounded-lg bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 transition disabled:opacity-50"
          >
            {installing ? <RefreshCw size={12} className="animate-spin" /> : 'Install'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Anthropic Import Tab ───────────────────────────────────

function AnthropicImportTab({ skills, loading, syncing, installing, onImport, onSyncAll, onRefresh }: {
  skills: AnthropicSkillInfo[];
  loading: boolean;
  syncing: boolean;
  installing: string | null;
  onImport: (name: string) => void;
  onSyncAll: () => void;
  onRefresh: () => void;
}) {
  return (
    <div>
      {/* Anthropic header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white">Import from Anthropic</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Import prompt-based skills from Anthropic's official skill repository
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-dark-600 text-slate-300 hover:bg-dark-700 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={onSyncAll}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition disabled:opacity-50"
          >
            {syncing ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
            Import All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : skills.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-slate-400">No Anthropic skills found</p>
          <p className="text-xs text-slate-600 mt-1">Check your network connection or GitHub token</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {skills.map(skill => (
            <div
              key={skill.name}
              className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-amber-500/20 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Sparkles size={16} className="text-amber-400" />
                  </div>
                  <h3 className="font-semibold text-sm text-white">{skill.name}</h3>
                </div>
                <a
                  href={`https://github.com/anthropics/skills/tree/main/${skill.folder}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-slate-300 transition"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
              <p className="text-xs text-slate-400 mb-3 line-clamp-2">{skill.description}</p>
              {skill.allowedTools.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {skill.allowedTools.slice(0, 3).map(t => (
                    <span key={t} className="px-1.5 py-0.5 bg-amber-500/5 text-amber-500/70 rounded text-[10px]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => onImport(skill.name)}
                disabled={installing === skill.name}
                className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition disabled:opacity-50"
              >
                {installing === skill.name
                  ? <><RefreshCw size={12} className="inline mr-1 animate-spin" />Importing...</>
                  : <><Download size={12} className="inline mr-1" />Import</>
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Updates Tab ────────────────────────────────────────────

function UpdatesTab({ updates, loading, onRefresh }: {
  updates: { skillId: string; currentVersion: string; latestVersion?: string; hasUpdate: boolean }[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const updatable = updates.filter(u => u.hasUpdate);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white">Skill Updates</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {updatable.length > 0
              ? `${updatable.length} update${updatable.length > 1 ? 's' : ''} available`
              : 'All skills are up to date'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-dark-600 text-slate-300 hover:bg-dark-700 transition disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Check Updates
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center py-20">
          <Check size={48} className="mx-auto text-emerald-500/30 mb-4" />
          <p className="text-slate-400">No installed skills to check</p>
        </div>
      ) : (
        <div className="space-y-2">
          {updates.map(u => (
            <div key={u.skillId} className="flex items-center gap-4 px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.hasUpdate ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                {u.hasUpdate ? <ArrowUpCircle size={16} className="text-amber-400" /> : <Check size={16} className="text-emerald-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-white">{u.skillId}</span>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>v{u.currentVersion}</span>
                  {u.hasUpdate && u.latestVersion && (
                    <>
                      <ChevronRight size={10} />
                      <span className="text-amber-400">v{u.latestVersion}</span>
                    </>
                  )}
                </div>
              </div>
              {u.hasUpdate && (
                <Badge variant="warning">Update available</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ───────────────────────────────────────────

function SkillDetailModal({ skill, installing, onClose, onInstall, onUninstall }: {
  skill: HubSkill;
  installing: boolean;
  onClose: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const CatIcon = CATEGORY_ICONS[skill.category] ?? Bot;
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    api.hub.getReviews(skill.id).then(r => setReviews(r.reviews ?? [])).catch(() => {});
  }, [skill.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-[640px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-dark-700">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-violet-600/15 flex items-center justify-center">
                <CatIcon size={24} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{skill.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>v{skill.version}</span>
                  <span>by {skill.author.name}</span>
                  {skill.author.verified && <Check size={11} className="text-blue-400" />}
                  <Badge variant={skill.source === 'anthropic' ? 'warning' : 'default'}>{skill.source}</Badge>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white transition rounded-lg hover:bg-dark-800">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-slate-300">{skill.description}</p>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-sm">
              <Star size={14} className="text-amber-400" />
              <span className="font-medium text-white">{skill.stats.rating.toFixed(1)}</span>
              <span className="text-slate-500">({skill.stats.reviews})</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <Download size={14} />
              <span>{skill.stats.downloads} downloads</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <Users size={14} />
              <span>{skill.stats.installs} installs</span>
            </div>
          </div>

          {/* Tags */}
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skill.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-dark-800 text-slate-400 rounded-full text-xs border border-dark-700">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
              <div className="text-slate-500 mb-1">License</div>
              <div className="font-medium text-slate-300">{skill.license}</div>
            </div>
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
              <div className="text-slate-500 mb-1">Category</div>
              <div className="font-medium text-slate-300 capitalize">{skill.category}</div>
            </div>
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
              <div className="text-slate-500 mb-1">Created</div>
              <div className="font-medium text-slate-300">{new Date(skill.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
              <div className="text-slate-500 mb-1">Updated</div>
              <div className="font-medium text-slate-300">{new Date(skill.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Reviews ({reviews.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {reviews.map((r: any) => (
                  <div key={r.id} className="bg-dark-800 rounded-lg p-3 border border-dark-700">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={10} className={i <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-dark-600'} />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">{r.author}</span>
                    </div>
                    {r.comment && <p className="text-xs text-slate-400">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-dark-600 text-slate-300 hover:bg-dark-800 transition"
          >
            Close
          </button>
          {skill.installed ? (
            <button
              onClick={onUninstall}
              disabled={installing}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition disabled:opacity-50"
            >
              {installing ? 'Removing...' : 'Uninstall'}
            </button>
          ) : (
            <button
              onClick={onInstall}
              disabled={installing}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition disabled:opacity-50"
            >
              {installing ? 'Installing...' : 'Install Skill'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
