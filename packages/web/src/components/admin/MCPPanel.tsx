// ============================================================
// MCPPanel - MCP Server Integration Management (HIS, etc.)
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/utils/api';
import {
    Server, Plus, Trash2, RefreshCw, Power, PowerOff,
    Activity, ChevronDown, ChevronUp, Loader2, AlertCircle,
    CheckCircle, XCircle, Plug, Database as DbIcon,
} from 'lucide-react';

// ── Preset definitions (mirrored from backend mcp-presets.ts) ────

interface MCPPreset {
    name: string;
    domain: string;
    transport: string;
    command?: string;
    description: string;
    envTemplate: Record<string, string>;
}

const MCP_PRESETS: MCPPreset[] = [
    { name: 'filesystem', domain: 'code', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem', description: 'File system access (read/write/list/search files)', envTemplate: {} },
    { name: 'github', domain: 'code', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-github', description: 'GitHub API access (repos, issues, PRs)', envTemplate: { GITHUB_PERSONAL_ACCESS_TOKEN: '' } },
    { name: 'brave-search', domain: 'web', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-brave-search', description: 'Web search via Brave API', envTemplate: { BRAVE_API_KEY: '' } },
    { name: 'fetch', domain: 'web', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-fetch', description: 'Fetch web pages and extract content', envTemplate: {} },
    { name: 'postgres', domain: 'data', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres', description: 'PostgreSQL database access (HIS integration)', envTemplate: { POSTGRES_CONNECTION_STRING: '' } },
    { name: 'sqlite', domain: 'data', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-sqlite', description: 'SQLite database access', envTemplate: {} },
    { name: 'google-drive', domain: 'productivity', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-gdrive', description: 'Google Drive file access', envTemplate: {} },
    { name: 'slack', domain: 'productivity', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-slack', description: 'Slack workspace interaction', envTemplate: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' } },
    { name: 'memory', domain: 'knowledge', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-memory', description: 'Persistent knowledge graph memory', envTemplate: {} },
    { name: 'docker', domain: 'devops', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-docker', description: 'Docker container management', envTemplate: {} },
    { name: 'puppeteer', domain: 'media', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-puppeteer', description: 'Browser automation and screenshots', envTemplate: {} },
];

const DOMAIN_COLORS: Record<string, string> = {
    code: 'text-blue-400 bg-blue-400/10',
    web: 'text-emerald-400 bg-emerald-400/10',
    data: 'text-amber-400 bg-amber-400/10',
    productivity: 'text-purple-400 bg-purple-400/10',
    knowledge: 'text-cyan-400 bg-cyan-400/10',
    devops: 'text-orange-400 bg-orange-400/10',
    media: 'text-pink-400 bg-pink-400/10',
    custom: 'text-slate-400 bg-slate-400/10',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    connected: <CheckCircle size={14} className="text-emerald-400" />,
    connecting: <Loader2 size={14} className="text-blue-400 animate-spin" />,
    disconnected: <XCircle size={14} className="text-slate-500" />,
    error: <AlertCircle size={14} className="text-red-400" />,
    disabled: <PowerOff size={14} className="text-slate-600" />,
};

interface MCPServer {
    id: string;
    name: string;
    description?: string;
    domain: string;
    transport: string;
    command?: string;
    url?: string;
    enabled: boolean;
    autoConnect: boolean;
    status: string;
    lastError?: string;
    presetName?: string;
    toolCount: number;
    createdAt: string;
}

export function MCPPanel() {
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAddPreset, setShowAddPreset] = useState(false);
    const [showCustom, setShowCustom] = useState(false);
    const [expandedServer, setExpandedServer] = useState<string | null>(null);
    const [filterDomain, setFilterDomain] = useState<string>('all');

    // Custom server form
    const [customForm, setCustomForm] = useState({
        name: '', description: '', domain: 'data', transport: 'stdio', command: '', url: '',
    });

    // Preset env form
    const [presetEnv, setPresetEnv] = useState<Record<string, string>>({});
    const [selectedPreset, setSelectedPreset] = useState<MCPPreset | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.getMCPServers();
            setServers(res.servers ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (server: MCPServer) => {
        setActionLoading(server.id);
        try {
            await api.toggleMCPServer(server.id, !server.enabled);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Toggle failed');
        }
        setActionLoading(null);
    };

    const handleHealthCheck = async (server: MCPServer) => {
        setActionLoading(`health-${server.id}`);
        try {
            await api.getMCPHealth(server.id);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Health check failed');
        }
        setActionLoading(`done-${server.id}`);
        setTimeout(() => setActionLoading(null), 500);
    };

    const registerPreset = async () => {
        if (!selectedPreset) return;
        setActionLoading('register');
        try {
            await api.registerMCPServer({ preset_name: selectedPreset.name, env: presetEnv });
            setSelectedPreset(null);
            setPresetEnv({});
            setShowAddPreset(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Register failed');
        }
        setActionLoading(null);
    };

    const registerCustom = async () => {
        if (!customForm.name || !customForm.domain || !customForm.transport) return;
        setActionLoading('register');
        try {
            await api.registerMCPServer({
                name: customForm.name,
                description: customForm.description || undefined,
                domain: customForm.domain,
                transport: customForm.transport,
                command: customForm.command || undefined,
                url: customForm.url || undefined,
            });
            setCustomForm({ name: '', description: '', domain: 'data', transport: 'stdio', command: '', url: '' });
            setShowCustom(false);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Register failed');
        }
        setActionLoading(null);
    };

    const registeredNames = new Set(servers.map(s => s.presetName ?? s.name));
    const availablePresets = MCP_PRESETS.filter(p => !registeredNames.has(p.name));
    const filtered = filterDomain === 'all' ? servers : servers.filter(s => s.domain === filterDomain);

    const domains = ['all', ...new Set(servers.map(s => s.domain))];

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/15 flex items-center justify-center">
                            <Plug size={20} className="text-primary-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">MCP Integrations</h1>
                            <p className="text-xs text-slate-500">Connect external tools & data sources via Model Context Protocol</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setShowAddPreset(!showAddPreset); setShowCustom(false); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition"
                        >
                            <Plus size={14} /> Add Preset
                        </button>
                        <button
                            onClick={() => { setShowCustom(!showCustom); setShowAddPreset(false); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 text-sm rounded-lg transition border border-dark-600"
                        >
                            <Server size={14} /> Custom
                        </button>
                        <button onClick={load} className="p-2 hover:bg-dark-800 rounded-lg text-slate-400 transition" title="Refresh">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-400">
                        <AlertCircle size={16} /> {error}
                        <button onClick={() => setError(null)} className="ml-auto text-red-400/70 hover:text-red-300">&times;</button>
                    </div>
                )}

                {/* Preset selector */}
                {showAddPreset && (
                    <div className="mb-6 bg-dark-800 border border-dark-700 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-slate-300 mb-3">Select a Preset</h2>
                        {availablePresets.length === 0 ? (
                            <p className="text-sm text-slate-500">All presets are already registered.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {availablePresets.map(preset => (
                                    <button
                                        key={preset.name}
                                        onClick={() => { setSelectedPreset(preset); setPresetEnv(Object.fromEntries(Object.entries(preset.envTemplate).map(([k]) => [k, '']))); }}
                                        className={`text-left p-3 rounded-lg border transition ${selectedPreset?.name === preset.name
                                                ? 'border-primary-500 bg-primary-600/10'
                                                : 'border-dark-600 hover:border-dark-500 bg-dark-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DOMAIN_COLORS[preset.domain] ?? DOMAIN_COLORS.custom}`}>
                                                {preset.domain}
                                            </span>
                                            <span className="text-sm font-medium text-white">{preset.name}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 line-clamp-2">{preset.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Env config for selected preset */}
                        {selectedPreset && Object.keys(selectedPreset.envTemplate).length > 0 && (
                            <div className="mt-4 space-y-3">
                                <h3 className="text-xs font-semibold text-slate-400">Environment Variables</h3>
                                {Object.entries(selectedPreset.envTemplate).map(([key]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">{key}</label>
                                        <input
                                            type={key.toLowerCase().includes('token') || key.toLowerCase().includes('key') ? 'password' : 'text'}
                                            value={presetEnv[key] ?? ''}
                                            onChange={e => setPresetEnv({ ...presetEnv, [key]: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
                                            placeholder={key}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedPreset && (
                            <div className="flex items-center gap-3 mt-4">
                                <button
                                    onClick={registerPreset}
                                    disabled={actionLoading === 'register'}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                                >
                                    {actionLoading === 'register' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Register {selectedPreset.name}
                                </button>
                                <button
                                    onClick={() => { setSelectedPreset(null); setPresetEnv({}); setShowAddPreset(false); }}
                                    className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Custom server form */}
                {showCustom && (
                    <div className="mb-6 bg-dark-800 border border-dark-700 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-slate-300 mb-3">Register Custom MCP Server</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
                                <input
                                    value={customForm.name}
                                    onChange={e => setCustomForm({ ...customForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                    placeholder="his-pharmacy-db"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Domain</label>
                                <select
                                    value={customForm.domain}
                                    onChange={e => setCustomForm({ ...customForm, domain: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                >
                                    {['code', 'web', 'data', 'productivity', 'knowledge', 'devops', 'media', 'custom'].map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Transport</label>
                                <select
                                    value={customForm.transport}
                                    onChange={e => setCustomForm({ ...customForm, transport: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                >
                                    <option value="stdio">stdio</option>
                                    <option value="sse">sse</option>
                                    <option value="streamable-http">streamable-http</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                                <input
                                    value={customForm.description}
                                    onChange={e => setCustomForm({ ...customForm, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                    placeholder="HIS Pharmacy database connector"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    {customForm.transport === 'stdio' ? 'Command' : 'URL'}
                                </label>
                                {customForm.transport === 'stdio' ? (
                                    <input
                                        value={customForm.command}
                                        onChange={e => setCustomForm({ ...customForm, command: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                                        placeholder="npx -y @modelcontextprotocol/server-postgres"
                                    />
                                ) : (
                                    <input
                                        value={customForm.url}
                                        onChange={e => setCustomForm({ ...customForm, url: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                                        placeholder="http://localhost:3100/sse"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                            <button
                                onClick={registerCustom}
                                disabled={!customForm.name || actionLoading === 'register'}
                                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                            >
                                {actionLoading === 'register' ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />}
                                Register Server
                            </button>
                            <button
                                onClick={() => setShowCustom(false)}
                                className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* HIS Quick-connect banner */}
                {!registeredNames.has('postgres') && (
                    <div className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                        <DbIcon size={20} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-amber-300">HIS Database Integration</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Connect your Hospital Information System via the PostgreSQL MCP server to enable direct pharmacy, patient, and prescription data queries.
                            </p>
                            <button
                                onClick={() => {
                                    const preset = MCP_PRESETS.find(p => p.name === 'postgres')!;
                                    setSelectedPreset(preset);
                                    setPresetEnv({ POSTGRES_CONNECTION_STRING: '' });
                                    setShowAddPreset(true);
                                    setShowCustom(false);
                                }}
                                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium rounded-lg transition"
                            >
                                <Plug size={12} /> Quick Connect HIS Database
                            </button>
                        </div>
                    </div>
                )}

                {/* Domain filter */}
                {servers.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                        {domains.map(d => (
                            <button
                                key={d}
                                onClick={() => setFilterDomain(d)}
                                className={`px-2.5 py-1 text-xs rounded-lg transition ${filterDomain === d
                                        ? 'bg-primary-600/20 text-primary-400 font-medium'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-dark-800'
                                    }`}
                            >
                                {d === 'all' ? 'All' : d}
                            </button>
                        ))}
                        <span className="ml-auto text-xs text-slate-600">{filtered.length} server{filtered.length !== 1 ? 's' : ''}</span>
                    </div>
                )}

                {/* Server list */}
                {loading && servers.length === 0 ? (
                    <div className="flex justify-center py-16">
                        <Loader2 size={24} className="animate-spin text-slate-500" />
                    </div>
                ) : servers.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <Server size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No MCP servers registered yet</p>
                        <p className="text-xs mt-1">Add a preset or register a custom server to get started</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(server => {
                            const expanded = expandedServer === server.id;
                            return (
                                <div
                                    key={server.id}
                                    className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden"
                                >
                                    {/* Server row */}
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        {/* Status indicator */}
                                        <div className="flex-shrink-0">{STATUS_ICONS[server.status] ?? STATUS_ICONS.disconnected}</div>

                                        {/* Name + domain */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white truncate">{server.name}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${DOMAIN_COLORS[server.domain] ?? DOMAIN_COLORS.custom}`}>
                                                    {server.domain}
                                                </span>
                                                {server.presetName && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-600 text-slate-500">preset</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                {server.description && (
                                                    <span className="text-xs text-slate-500 truncate">{server.description}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
                                            <span>{server.transport}</span>
                                            <span>{server.toolCount} tools</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleHealthCheck(server)}
                                                disabled={!server.enabled}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-dark-700 disabled:opacity-30 transition"
                                                title="Health Check"
                                            >
                                                {actionLoading === `health-${server.id}` ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Activity size={14} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleToggle(server)}
                                                disabled={actionLoading === server.id}
                                                className={`p-1.5 rounded-lg transition ${server.enabled
                                                        ? 'text-emerald-400 hover:text-red-400 hover:bg-dark-700'
                                                        : 'text-slate-600 hover:text-emerald-400 hover:bg-dark-700'
                                                    }`}
                                                title={server.enabled ? 'Disable' : 'Enable'}
                                            >
                                                {actionLoading === server.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : server.enabled ? (
                                                    <Power size={14} />
                                                ) : (
                                                    <PowerOff size={14} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setExpandedServer(expanded ? null : server.id)}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-dark-700 transition"
                                            >
                                                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded detail */}
                                    {expanded && (
                                        <div className="border-t border-dark-700 px-4 py-3 bg-dark-900/50">
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                                <div>
                                                    <span className="text-slate-600 block mb-0.5">ID</span>
                                                    <span className="text-slate-400 font-mono text-[11px] break-all">{server.id}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-600 block mb-0.5">Transport</span>
                                                    <span className="text-slate-400">{server.transport}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-600 block mb-0.5">Status</span>
                                                    <span className={`${server.status === 'connected' ? 'text-emerald-400' : server.status === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
                                                        {server.status}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-600 block mb-0.5">Auto-connect</span>
                                                    <span className="text-slate-400">{server.autoConnect ? 'Yes' : 'No'}</span>
                                                </div>
                                                {server.command && (
                                                    <div className="sm:col-span-4">
                                                        <span className="text-slate-600 block mb-0.5">Command</span>
                                                        <code className="text-slate-400 text-[11px] font-mono bg-dark-800 px-2 py-1 rounded block">{server.command}</code>
                                                    </div>
                                                )}
                                                {server.url && (
                                                    <div className="sm:col-span-4">
                                                        <span className="text-slate-600 block mb-0.5">URL</span>
                                                        <code className="text-slate-400 text-[11px] font-mono bg-dark-800 px-2 py-1 rounded block">{server.url}</code>
                                                    </div>
                                                )}
                                                {server.lastError && (
                                                    <div className="sm:col-span-4">
                                                        <span className="text-red-500 block mb-0.5">Last Error</span>
                                                        <pre className="text-red-400 text-[11px] font-mono bg-red-500/5 px-2 py-1 rounded whitespace-pre-wrap">{server.lastError}</pre>
                                                    </div>
                                                )}
                                                <div className="sm:col-span-4">
                                                    <span className="text-slate-600 block mb-0.5">Created</span>
                                                    <span className="text-slate-400">{new Date(server.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
