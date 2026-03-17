import React, { useState, useMemo, useEffect } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Badge, Button } from '@/components/ui';
import {
    Store, Search, Download, Trash2, Power, ChevronRight,
    X, Wrench, Tag, User, BarChart3, GitBranch, FileText,
    Globe, DollarSign, Briefcase, GraduationCap, Palette,
    HeartPulse, Code2, Bot, Sparkles, Check, ExternalLink,
    Filter, Grid3X3, List, Settings, Plus, ArrowDownAZ,
    TrendingUp, SortAsc, ArrowUpCircle, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { SkillStudio } from './SkillStudio';
import { StoreInstallModal } from './StoreInstallModal';

// ─── Agent Registry Data ────────────────────────────────────

export interface AgentInfo {
    id: string;
    name: string;
    description: string;
    longDescription: string;
    version: string;
    author: string;
    category: AgentCategory;
    icon: React.ElementType;
    color: string;
    tags: string[];
    toolCount: number;
    tools: { name: string; description: string }[];
    status: 'available' | 'installed' | 'active';
    featured?: boolean;
    isBuiltIn?: boolean;
}

type AgentCategory = 'all' | 'programming' | 'devops' | 'analytics' | 'content' | 'research' | 'sales' | 'project-management' | 'learning' | 'finance' | 'design' | 'healthcare';

const CATEGORIES: { id: AgentCategory; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'All Agents', icon: Grid3X3 },
    { id: 'programming', label: 'Programming', icon: Code2 },
    { id: 'devops', label: 'DevOps', icon: GitBranch },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'research', label: 'Research', icon: Globe },
    { id: 'sales', label: 'Sales/CRM', icon: DollarSign },
    { id: 'project-management', label: 'Project Mgmt', icon: Briefcase },
    { id: 'learning', label: 'Learning', icon: GraduationCap },
    { id: 'finance', label: 'Finance', icon: DollarSign },
    { id: 'design', label: 'Design', icon: Palette },
    { id: 'healthcare', label: 'Healthcare', icon: HeartPulse },
];

const AGENT_REGISTRY: AgentInfo[] = [
    // ── Built-in agents ──
    {
        id: 'programming',
        name: 'Programming & DevOps',
        description: 'Code generation, execution, Git, testing, and development tools',
        longDescription: 'Full-stack development assistant with shell execution, file management, Git operations, test runner auto-detection, code search with regex, and project structure analysis. Supports Node.js, Python, Rust, Go, and Java projects.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'programming',
        icon: Code2,
        color: '#3b82f6',
        tags: ['code', 'git', 'devops', 'testing', 'ci-cd'],
        toolCount: 11,
        tools: [
            { name: 'shell_exec', description: 'Execute shell commands safely' },
            { name: 'file_read', description: 'Read file contents' },
            { name: 'file_write', description: 'Write content to files' },
            { name: 'file_list', description: 'List directory contents' },
            { name: 'git_status', description: 'Get git repository status' },
            { name: 'git_diff', description: 'View staged/unstaged changes' },
            { name: 'git_commit', description: 'Create git commits' },
            { name: 'git_log', description: 'View commit history' },
            { name: 'run_tests', description: 'Auto-detect and run test suites' },
            { name: 'code_search', description: 'Search code with grep/ripgrep' },
            { name: 'project_analyze', description: 'Analyze project structure' },
        ],
        status: 'active',
        isBuiltIn: true,
        featured: true,
    },
    {
        id: 'healthcare',
        name: 'Healthcare Assistant',
        description: 'Symptom analysis, medication management, health metrics, and clinical notes',
        longDescription: 'Comprehensive healthcare AI assistant with symptom analysis, drug interaction checking, medication scheduling, health metrics tracking, appointment management, medical records, health reports, clinical note generation, and ICD code lookup.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'healthcare',
        icon: HeartPulse,
        color: '#ef4444',
        tags: ['health', 'medical', 'symptoms', 'medications'],
        toolCount: 11,
        tools: [
            { name: 'symptom_analyze', description: 'Analyze symptoms and suggest conditions' },
            { name: 'medication_check_interaction', description: 'Check drug interactions' },
            { name: 'medication_schedule', description: 'Create medication schedules' },
            { name: 'health_metrics_log', description: 'Log health measurements' },
            { name: 'health_metrics_query', description: 'Query health data trends' },
            { name: 'appointment_manage', description: 'Manage appointments' },
            { name: 'medical_record', description: 'Access medical records' },
            { name: 'health_report', description: 'Generate health reports' },
            { name: 'clinical_note', description: 'Create clinical notes' },
            { name: 'icd_lookup', description: 'Lookup ICD diagnostic codes' },
        ],
        status: 'active',
        isBuiltIn: true,
    },
    // ── New agents ──
    {
        id: 'data-analytics',
        name: 'Data Analytics',
        description: 'Query data, transform datasets, generate charts, and create reports',
        longDescription: 'Powerful data analytics agent that can execute SQL-like queries on datasets, transform and clean data, generate visualization charts, create comprehensive reports, parse CSV/JSON files, and compute statistical summaries.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'analytics',
        icon: BarChart3,
        color: '#8b5cf6',
        tags: ['data', 'analytics', 'charts', 'reports', 'sql', 'csv'],
        toolCount: 6,
        tools: [
            { name: 'data_query', description: 'Execute SQL-like queries on datasets' },
            { name: 'data_transform', description: 'Transform, filter, and clean data' },
            { name: 'chart_generate', description: 'Generate data visualization charts' },
            { name: 'report_create', description: 'Create formatted analysis reports' },
            { name: 'csv_parse', description: 'Parse and analyze CSV/JSON files' },
            { name: 'stats_summary', description: 'Compute statistical summaries' },
        ],
        status: 'available',
        featured: true,
    },
    {
        id: 'devops',
        name: 'DevOps Engineer',
        description: 'Docker management, CI/CD pipelines, log analysis, and infrastructure monitoring',
        longDescription: 'DevOps automation agent for managing Docker containers, triggering CI/CD pipelines, analyzing application logs, checking deployment status, monitoring infrastructure health, and managing environment configurations.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'devops',
        icon: GitBranch,
        color: '#f59e0b',
        tags: ['docker', 'ci-cd', 'deploy', 'monitoring', 'logs'],
        toolCount: 6,
        tools: [
            { name: 'docker_manage', description: 'Manage Docker containers and images' },
            { name: 'ci_trigger', description: 'Trigger and monitor CI/CD pipelines' },
            { name: 'log_analyze', description: 'Analyze application and system logs' },
            { name: 'deploy_status', description: 'Check deployment status and health' },
            { name: 'infra_check', description: 'Monitor infrastructure resources' },
            { name: 'env_manage', description: 'Manage environment configurations' },
        ],
        status: 'available',
        featured: true,
    },
    {
        id: 'content-writer',
        name: 'Content Writer',
        description: 'Generate articles, SEO analysis, translation, summarization, and proofreading',
        longDescription: 'AI-powered content creation agent that generates blog posts, articles, and social media content. Includes SEO analysis, multi-language translation, text summarization, and grammar/style proofreading capabilities.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'content',
        icon: FileText,
        color: '#10b981',
        tags: ['content', 'seo', 'writing', 'translate', 'blog'],
        toolCount: 5,
        tools: [
            { name: 'content_generate', description: 'Generate articles, blogs, social posts' },
            { name: 'seo_analyze', description: 'Analyze content for SEO optimization' },
            { name: 'text_summarize', description: 'Summarize long texts and documents' },
            { name: 'translate_text', description: 'Translate text between languages' },
            { name: 'proofread', description: 'Check grammar, style, and clarity' },
        ],
        status: 'available',
    },
    {
        id: 'research',
        name: 'Research Agent',
        description: 'Web search, data collection, fact-checking, and research report generation',
        longDescription: 'Intelligent research assistant that can search the web, scrape and collect data from websites, compare information from multiple sources, verify facts, and compile comprehensive research reports.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'research',
        icon: Globe,
        color: '#06b6d4',
        tags: ['research', 'search', 'web', 'reports', 'fact-check'],
        toolCount: 5,
        tools: [
            { name: 'web_search', description: 'Search the web for information' },
            { name: 'web_scrape', description: 'Extract data from web pages' },
            { name: 'compare_data', description: 'Compare data from multiple sources' },
            { name: 'fact_check', description: 'Verify claims and check facts' },
            { name: 'research_report', description: 'Generate structured research reports' },
        ],
        status: 'available',
    },
    {
        id: 'sales-crm',
        name: 'Sales & CRM',
        description: 'Lead management, email outreach, pipeline tracking, and sales analytics',
        longDescription: 'Sales automation agent for managing customer relationships, composing personalized outreach emails, scoring leads with AI, generating pipeline reports, and scheduling follow-up activities.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'sales',
        icon: DollarSign,
        color: '#ec4899',
        tags: ['sales', 'crm', 'leads', 'email', 'pipeline'],
        toolCount: 5,
        tools: [
            { name: 'crm_search', description: 'Search and query CRM records' },
            { name: 'email_compose', description: 'Compose personalized outreach emails' },
            { name: 'lead_score', description: 'AI-powered lead scoring' },
            { name: 'pipeline_report', description: 'Generate sales pipeline reports' },
            { name: 'schedule_followup', description: 'Schedule follow-up activities' },
        ],
        status: 'available',
    },
    {
        id: 'project-manager',
        name: 'Project Manager',
        description: 'Task tracking, sprint planning, progress reports, and risk assessment',
        longDescription: 'AI project management assistant that creates and tracks tasks, plans sprint cycles, generates progress reports, summarizes standup meetings, and assesses project risks with mitigation strategies.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'project-management',
        icon: Briefcase,
        color: '#f97316',
        tags: ['project', 'tasks', 'sprint', 'agile', 'planning'],
        toolCount: 5,
        tools: [
            { name: 'task_create', description: 'Create and assign project tasks' },
            { name: 'sprint_plan', description: 'Plan sprint cycles and backlog' },
            { name: 'progress_report', description: 'Generate progress reports' },
            { name: 'standup_summary', description: 'Summarize standup meetings' },
            { name: 'risk_assess', description: 'Assess and track project risks' },
        ],
        status: 'available',
    },
    {
        id: 'learning',
        name: 'Learning & Training',
        description: 'Quiz generation, flashcards, curriculum planning, and study recommendations',
        longDescription: 'Educational AI agent that generates quizzes from content, creates flashcard sets, plans learning curricula, tracks study progress, and recommends personalized study strategies.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'learning',
        icon: GraduationCap,
        color: '#a855f7',
        tags: ['learning', 'quiz', 'flashcards', 'education', 'training'],
        toolCount: 5,
        tools: [
            { name: 'quiz_generate', description: 'Generate quizzes from content' },
            { name: 'flashcard_create', description: 'Create study flashcard sets' },
            { name: 'curriculum_plan', description: 'Plan learning curricula' },
            { name: 'progress_track', description: 'Track learning progress' },
            { name: 'study_recommend', description: 'Recommend study strategies' },
        ],
        status: 'available',
    },
    {
        id: 'finance',
        name: 'Finance & Accounting',
        description: 'Budget tracking, invoicing, expense reports, tax calculation, and forecasting',
        longDescription: 'Financial management agent for tracking budgets, creating invoices, generating expense reports, calculating taxes, and producing financial forecasts with trend analysis.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'finance',
        icon: DollarSign,
        color: '#22c55e',
        tags: ['finance', 'budget', 'invoice', 'tax', 'accounting'],
        toolCount: 5,
        tools: [
            { name: 'budget_track', description: 'Track and manage budgets' },
            { name: 'invoice_create', description: 'Create and send invoices' },
            { name: 'expense_report', description: 'Generate expense reports' },
            { name: 'tax_calculate', description: 'Calculate taxes and deductions' },
            { name: 'financial_forecast', description: 'Generate financial forecasts' },
        ],
        status: 'available',
    },
    {
        id: 'design',
        name: 'Design Assistant',
        description: 'Color palettes, UI mockups, icon suggestions, layout analysis, and design systems',
        longDescription: 'Creative design assistant that generates color palettes, creates UI mockup descriptions, suggests icons, analyzes layout structures, and checks design system compliance.',
        version: '1.0.0',
        author: 'xClaw',
        category: 'design',
        icon: Palette,
        color: '#f43f5e',
        tags: ['design', 'ui', 'ux', 'colors', 'mockup'],
        toolCount: 5,
        tools: [
            { name: 'color_palette', description: 'Generate harmonious color palettes' },
            { name: 'ui_mockup', description: 'Create UI mockup descriptions' },
            { name: 'icon_suggest', description: 'Suggest icons for concepts' },
            { name: 'layout_analyze', description: 'Analyze UI layout structure' },
            { name: 'design_system_check', description: 'Check design system compliance' },
        ],
        status: 'available',
    },
];

type StoreTab = 'browse' | 'installed';
type SortBy = 'featured' | 'name' | 'tools';

// Icon map from registry string → lucide component
const ICON_MAP: Record<string, React.ElementType> = {
    Code2, HeartPulse, BarChart3, GitBranch, FileText,
    Globe, DollarSign, Briefcase, GraduationCap, Palette, Bot,
};

interface UpdateInfo {
    hasUpdate: boolean;
    isOutdated: boolean;
    latestVersion: string;
    currentVersion: string;
    releaseNotes: string;
    changelog: string;
    updateCommand: string;
}

export function AgentHub() {
    const [agents, setAgents] = useState<AgentInfo[]>(AGENT_REGISTRY);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<AgentCategory>('all');
    const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [installing, setInstalling] = useState<string | null>(null);
    const [storeTab, setStoreTab] = useState<StoreTab>('browse');
    const [sortBy, setSortBy] = useState<SortBy>('featured');
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [configuringAgent, setConfiguringAgent] = useState<AgentInfo | null>(null);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [updateDismissed, setUpdateDismissed] = useState(false);
    const [registryLoading, setRegistryLoading] = useState(false);

    // Fetch agent registry from docs API + check for updates
    useEffect(() => {
        // Check for version updates
        api.checkForUpdates().then(info => {
            if (info.hasUpdate || info.isOutdated) {
                setUpdateInfo(info);
            }
        }).catch(() => { /* offline or unreachable, skip */ });

        // Fetch remote agent registry and merge with local
        setRegistryLoading(true);
        api.getAgentRegistry().then(registry => {
            if (registry?.agents?.length) {
                setAgents(prev => {
                    const localIds = new Set(prev.map(a => a.id));
                    const merged = [...prev];
                    for (const remote of registry.agents) {
                        if (!localIds.has(remote.id)) {
                            // New agent from registry — add it
                            merged.push({
                                id: remote.id,
                                name: remote.name,
                                description: remote.description,
                                longDescription: remote.longDescription,
                                version: remote.version,
                                author: remote.author,
                                category: remote.category as AgentCategory,
                                icon: ICON_MAP[remote.icon] ?? Bot,
                                color: remote.color,
                                tags: remote.tags,
                                toolCount: remote.toolCount,
                                tools: remote.tools,
                                status: 'available',
                                featured: remote.featured,
                                isBuiltIn: remote.isBuiltIn,
                            });
                        } else {
                            // Existing agent — update version info from registry
                            const idx = merged.findIndex(a => a.id === remote.id);
                            if (idx >= 0 && remote.version !== merged[idx].version) {
                                merged[idx] = { ...merged[idx], version: remote.version };
                            }
                        }
                    }
                    return merged;
                });
            }
        }).catch(() => { /* offline, use local registry */ }).finally(() => setRegistryLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let list = agents.filter(a => {
            const matchCat = category === 'all' || a.category === category;
            const q = search.toLowerCase();
            const matchSearch = !q ||
                a.name.toLowerCase().includes(q) ||
                a.description.toLowerCase().includes(q) ||
                a.tags.some(t => t.includes(q));
            const matchTab = storeTab === 'browse' || a.status !== 'available';
            return matchCat && matchSearch && matchTab;
        });

        // Sort
        if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'tools') list.sort((a, b) => b.toolCount - a.toolCount);
        else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

        return list;
    }, [agents, search, category, storeTab, sortBy]);

    const stats = useMemo(() => ({
        total: agents.length,
        installed: agents.filter(a => a.status === 'installed' || a.status === 'active').length,
        active: agents.filter(a => a.status === 'active').length,
    }), [agents]);

    const handleInstall = async (agentId: string) => {
        setInstalling(agentId);
        try {
            await api.activateSkill(agentId);
            setAgents(prev => prev.map(a =>
                a.id === agentId ? { ...a, status: 'active' } : a
            ));
        } catch {
            // Optimistic: set to installed even if backend unavailable
            setAgents(prev => prev.map(a =>
                a.id === agentId ? { ...a, status: 'active' } : a
            ));
        } finally {
            setInstalling(null);
        }
    };

    const handleUninstall = async (agentId: string) => {
        setInstalling(agentId);
        try {
            await api.deactivateSkill(agentId);
        } catch { /* ok */ }
        setAgents(prev => prev.map(a =>
            a.id === agentId ? { ...a, status: 'available' } : a
        ));
        setInstalling(null);
    };

    const handleConfigure = (agent: AgentInfo) => {
        setSelectedAgent(null);
        setConfiguringAgent(agent);
    };

    // ── Full-page SkillStudio mode ──
    if (configuringAgent) {
        return (
            <SkillStudio
                agent={{
                    id: configuringAgent.id,
                    name: configuringAgent.name,
                    version: configuringAgent.version,
                    description: configuringAgent.longDescription,
                    author: configuringAgent.author,
                    category: configuringAgent.category,
                    tags: configuringAgent.tags,
                    icon: '', // Will map from icon component
                    iconColor: configuringAgent.color,
                    iconBg: `bg-[${configuringAgent.color}20]`,
                    tools: configuringAgent.tools.map(t => ({
                        name: t.name,
                        description: t.description,
                        category: configuringAgent.category,
                    })),
                    config: [],
                    isBuiltIn: configuringAgent.isBuiltIn,
                    status: configuringAgent.status,
                }}
                onBack={() => setConfiguringAgent(null)}
            />
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Hero header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary-600/10 via-dark-900 to-purple-600/10 border-b border-dark-700">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
                <div className="relative px-6 py-8 max-w-7xl mx-auto">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-primary-600/20 flex items-center justify-center">
                                    <Store size={22} className="text-primary-400" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Agent Hub</h1>
                                    <p className="text-xs text-slate-400">Browse, install, and manage AI agents for your workspace</p>
                                </div>
                            </div>
                        </div>
                        {/* Stats */}
                        <div className="flex items-center gap-6 text-center">
                            <div>
                                <div className="text-2xl font-bold text-white">{stats.total}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
                            </div>
                            <div className="w-px h-8 bg-dark-700" />
                            <div>
                                <div className="text-2xl font-bold text-green-400">{stats.active}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Active</div>
                            </div>
                            <div className="w-px h-8 bg-dark-700" />
                            <div>
                                <div className="text-2xl font-bold text-blue-400">{stats.installed}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Installed</div>
                            </div>
                        </div>
                    </div>

                    {/* Search + sort + view toggle */}
                    <div className="flex items-center gap-3 mt-5">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search agents by name, description, or tag..."
                                className="w-full pl-10 pr-4 py-2.5 bg-dark-800/80 border border-dark-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition backdrop-blur"
                            />
                        </div>
                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortBy)}
                            className="px-3 py-2.5 bg-dark-800/80 border border-dark-700 rounded-xl text-sm text-slate-300 cursor-pointer outline-none focus:border-primary-500"
                        >
                            <option value="featured">⭐ Featured</option>
                            <option value="name">🔤 Name</option>
                            <option value="tools">🔧 Most Tools</option>
                        </select>
                        <div className="flex items-center bg-dark-800 border border-dark-700 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition ${viewMode === 'grid' ? 'bg-primary-600/20 text-primary-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Grid3X3 size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition ${viewMode === 'list' ? 'bg-primary-600/20 text-primary-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-5">
                {/* Version update banner */}
                {updateInfo && !updateDismissed && (
                    <div className={`mb-4 rounded-xl border p-4 flex items-center justify-between ${updateInfo.isOutdated
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'
                        }`}>
                        <div className="flex items-center gap-3">
                            {updateInfo.isOutdated ? (
                                <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                            ) : (
                                <ArrowUpCircle size={20} className="text-amber-400 flex-shrink-0" />
                            )}
                            <div>
                                <p className={`text-sm font-medium ${updateInfo.isOutdated ? 'text-red-300' : 'text-amber-300'}`}>
                                    {updateInfo.isOutdated
                                        ? `Phiên bản hiện tại (v${updateInfo.currentVersion}) đã quá cũ. Vui lòng cập nhật lên v${updateInfo.latestVersion}`
                                        : `Có phiên bản mới v${updateInfo.latestVersion} (hiện tại: v${updateInfo.currentVersion})`
                                    }
                                </p>
                                {updateInfo.releaseNotes && (
                                    <p className="text-xs text-slate-400 mt-0.5">{updateInfo.releaseNotes}</p>
                                )}
                                <code className="text-[11px] text-slate-400 bg-dark-800 px-2 py-0.5 rounded mt-1.5 inline-block font-mono">
                                    {updateInfo.updateCommand}
                                </code>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            {updateInfo.changelog && (
                                <a
                                    href={updateInfo.changelog}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-700 text-slate-300 hover:bg-dark-600 hover:text-white transition"
                                >
                                    <ExternalLink size={12} /> Changelog
                                </a>
                            )}
                            <button
                                onClick={() => setUpdateDismissed(true)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-dark-700 transition"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
                {/* Store Tabs + Install button */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1 bg-dark-800 border border-dark-700 rounded-xl p-1">
                        <button
                            onClick={() => setStoreTab('browse')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${storeTab === 'browse'
                                    ? 'bg-primary-600/20 text-primary-400'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Store size={14} /> Browse
                        </button>
                        <button
                            onClick={() => setStoreTab('installed')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${storeTab === 'installed'
                                    ? 'bg-primary-600/20 text-primary-400'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Download size={14} /> Installed ({stats.installed})
                        </button>
                    </div>
                    <button
                        onClick={() => setShowInstallModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 transition"
                    >
                        <Plus size={16} /> Install from...
                    </button>
                </div>
                {/* Category filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-4 scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${category === cat.id
                                    ? 'bg-primary-600/20 text-primary-400 ring-1 ring-primary-500/30'
                                    : 'bg-dark-800 text-slate-400 hover:bg-dark-700 hover:text-slate-200'
                                }`}
                        >
                            <cat.icon size={13} />
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Agent grid / list */}
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(agent => (
                            <AgentCard
                                key={agent.id}
                                agent={agent}
                                installing={installing === agent.id}
                                onInstall={() => handleInstall(agent.id)}
                                onUninstall={() => handleUninstall(agent.id)}
                                onSelect={() => setSelectedAgent(agent)}
                                onConfigure={() => handleConfigure(agent)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(agent => (
                            <AgentListItem
                                key={agent.id}
                                agent={agent}
                                installing={installing === agent.id}
                                onInstall={() => handleInstall(agent.id)}
                                onUninstall={() => handleUninstall(agent.id)}
                                onSelect={() => setSelectedAgent(agent)}
                                onConfigure={() => handleConfigure(agent)}
                            />
                        ))}
                    </div>
                )}

                {filtered.length === 0 && (
                    <div className="text-center py-16">
                        <Bot size={48} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-sm text-slate-400">No agents found matching your criteria</p>
                        <button onClick={() => { setSearch(''); setCategory('all'); }} className="mt-2 text-xs text-primary-400 hover:underline">
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedAgent && (
                <AgentDetailModal
                    agent={selectedAgent}
                    installing={installing === selectedAgent.id}
                    onClose={() => setSelectedAgent(null)}
                    onInstall={() => handleInstall(selectedAgent.id)}
                    onUninstall={() => handleUninstall(selectedAgent.id)}
                    onConfigure={() => handleConfigure(selectedAgent)}
                />
            )}

            {/* Store Install Modal */}
            <StoreInstallModal
                isOpen={showInstallModal}
                onClose={() => setShowInstallModal(false)}
            />
        </div>
    );
}

// ─── Agent Card ─────────────────────────────────────────────

function AgentCard({
    agent, installing, onInstall, onUninstall, onSelect, onConfigure,
}: {
    agent: AgentInfo;
    installing: boolean;
    onInstall: () => void;
    onUninstall: () => void;
    onSelect: () => void;
    onConfigure: () => void;
}) {
    const isActive = agent.status === 'active' || agent.status === 'installed';

    return (
        <div className="group relative bg-dark-800 border border-dark-700 rounded-xl overflow-hidden hover:border-dark-600 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-200">
            {agent.featured && (
                <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                        <Sparkles size={10} /> Featured
                    </span>
                </div>
            )}

            <div className="p-5 cursor-pointer" onClick={onSelect}>
                {/* Icon + Meta */}
                <div className="flex items-start gap-3 mb-3">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: agent.color + '20' }}
                    >
                        <agent.icon size={22} style={{ color: agent.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white text-sm leading-tight">{agent.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500">v{agent.version}</span>
                            <span className="text-[10px] text-slate-600">•</span>
                            <span className="text-[10px] text-slate-500">{agent.author}</span>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">{agent.description}</p>

                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {agent.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] bg-dark-700 text-slate-400 px-2 py-0.5 rounded-full">
                            {tag}
                        </span>
                    ))}
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Wrench size={10} /> {agent.toolCount} tools
                    </span>
                </div>
            </div>

            {/* Footer action */}
            <div className="px-5 py-3 border-t border-dark-700 flex items-center justify-between">
                {isActive ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <Check size={12} /> Active
                    </span>
                ) : (
                    <span className="text-xs text-slate-500">Available</span>
                )}

                <div className="flex items-center gap-2">
                    {isActive && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfigure(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-700 text-slate-300 hover:bg-dark-600 hover:text-white transition"
                        >
                            <Settings size={12} /> Configure
                        </button>
                    )}
                    {agent.isBuiltIn ? (
                        <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">Built-in</span>
                    ) : isActive ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUninstall(); }}
                            disabled={installing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                        >
                            <Trash2 size={12} /> Uninstall
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onInstall(); }}
                            disabled={installing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition disabled:opacity-50"
                        >
                            {installing ? (
                                <><span className="w-3 h-3 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" /> Installing...</>
                            ) : (
                                <><Download size={12} /> Install</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Agent List Item ────────────────────────────────────────

function AgentListItem({
    agent, installing, onInstall, onUninstall, onSelect, onConfigure,
}: {
    agent: AgentInfo;
    installing: boolean;
    onInstall: () => void;
    onUninstall: () => void;
    onSelect: () => void;
    onConfigure: () => void;
}) {
    const isActive = agent.status === 'active' || agent.status === 'installed';

    return (
        <div
            onClick={onSelect}
            className="flex items-center gap-4 p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-dark-600 cursor-pointer transition"
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: agent.color + '20' }}
            >
                <agent.icon size={20} style={{ color: agent.color }} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white text-sm">{agent.name}</h3>
                    {agent.featured && <Sparkles size={12} className="text-amber-400" />}
                    <span className="text-[10px] text-slate-500">v{agent.version}</span>
                    {isActive && <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />}
                </div>
                <p className="text-xs text-slate-400 truncate">{agent.description}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Wrench size={10} /> {agent.toolCount}
                </span>
                {isActive && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onConfigure(); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-dark-700 transition"
                        title="Configure"
                    >
                        <Settings size={14} />
                    </button>
                )}
                {agent.isBuiltIn ? (
                    <span className="text-[10px] bg-dark-700 text-slate-500 px-2 py-0.5 rounded-full">Built-in</span>
                ) : isActive ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onUninstall(); }}
                        disabled={installing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                    >
                        <Trash2 size={12} /> Remove
                    </button>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onInstall(); }}
                        disabled={installing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition"
                    >
                        <Download size={12} /> Install
                    </button>
                )}
                <ChevronRight size={14} className="text-slate-600" />
            </div>
        </div>
    );
}

// ─── Agent Detail Modal ─────────────────────────────────────

function AgentDetailModal({
    agent, installing, onClose, onInstall, onUninstall, onConfigure,
}: {
    agent: AgentInfo;
    installing: boolean;
    onClose: () => void;
    onInstall: () => void;
    onUninstall: () => void;
    onConfigure: () => void;
}) {
    const isActive = agent.status === 'active' || agent.status === 'installed';

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
            <div className="fixed inset-4 md:inset-y-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:max-w-2xl md:w-full bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 p-6 border-b border-dark-700">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: agent.color + '20' }}
                    >
                        <agent.icon size={28} style={{ color: agent.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">{agent.name}</h2>
                            {agent.featured && (
                                <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                    <Sparkles size={10} /> Featured
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-400">v{agent.version}</span>
                            <span className="text-xs text-slate-500">by {agent.author}</span>
                            <Badge variant={isActive ? 'success' : 'default'}>
                                {isActive ? 'Active' : 'Available'}
                            </Badge>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Description */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Description</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{agent.longDescription}</p>
                    </div>

                    {/* Tags */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {agent.tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1 text-xs bg-dark-800 text-slate-400 px-2.5 py-1 rounded-lg">
                                    <Tag size={10} /> {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Tools */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                            Tools ({agent.toolCount})
                        </h3>
                        <div className="space-y-2">
                            {agent.tools.map(tool => (
                                <div key={tool.name} className="flex items-start gap-3 p-3 bg-dark-800 rounded-xl">
                                    <div className="w-7 h-7 rounded-lg bg-primary-600/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Wrench size={13} className="text-primary-400" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-mono text-white font-medium">{tool.name}</span>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{tool.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-dark-800 rounded-xl">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Category</span>
                            <p className="text-sm text-white mt-0.5 capitalize">{agent.category.replace('-', ' ')}</p>
                        </div>
                        <div className="p-3 bg-dark-800 rounded-xl">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Author</span>
                            <p className="text-sm text-white mt-0.5">{agent.author}</p>
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="p-6 border-t border-dark-700 flex items-center justify-between">
                    {agent.isBuiltIn ? (
                        <span className="text-xs text-slate-500">This is a built-in agent and cannot be removed</span>
                    ) : (
                        <span className="text-xs text-slate-500">Manage this agent</span>
                    )}

                    <div className="flex items-center gap-3">
                        {(isActive || agent.isBuiltIn) && (
                            <button
                                onClick={onConfigure}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-dark-800 text-slate-300 hover:bg-dark-700 hover:text-white transition"
                            >
                                <Settings size={13} /> Configure
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-slate-400 bg-dark-800 hover:bg-dark-700 transition">
                            Close
                        </button>
                        {!agent.isBuiltIn && (
                            isActive ? (
                                <button
                                    onClick={onUninstall}
                                    disabled={installing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
                                >
                                    <Trash2 size={13} /> Uninstall Agent
                                </button>
                            ) : (
                                <button
                                    onClick={onInstall}
                                    disabled={installing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-500 transition disabled:opacity-50"
                                >
                                    {installing ? (
                                        <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Installing...</>
                                    ) : (
                                        <><Download size={13} /> Install Agent</>
                                    )}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
