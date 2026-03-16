import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api.js';
import {
    BarChart3, Cpu, Database, Layers, Activity, Clock,
    Server, HardDrive, Zap, CheckCircle, XCircle,
    AlertTriangle, Loader2, RefreshCw, Wrench, Brain,
} from 'lucide-react';

interface ResourceOverview {
    models: Array<{
        id: string;
        name: string;
        provider: string;
        model_id: string;
        status: string;
        is_default: boolean;
    }>;
    knowledgeBase: {
        totalCollections: number;
        collections: Array<{
            collectionId: string;
            name: string;
            documentCount: number;
            chunkCount: number;
            totalTokens: number;
            totalSizeBytes: number;
        }>;
    };
    health: Record<string, unknown>;
    tools: { total: number };
    skills: { total: number; active: string[] };
    gateway: { sessions: number; uptime: number };
}

export function ResourcesDashboard() {
    const [data, setData] = useState<ResourceOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const overview = await api.getResourceOverview();
            setData(overview);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load resources');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const totalKBDocs = data?.knowledgeBase.collections.reduce((s, c) => s + c.documentCount, 0) ?? 0;
    const totalKBChunks = data?.knowledgeBase.collections.reduce((s, c) => s + c.chunkCount, 0) ?? 0;
    const totalKBTokens = data?.knowledgeBase.collections.reduce((s, c) => s + c.totalTokens, 0) ?? 0;
    const totalKBSize = data?.knowledgeBase.collections.reduce((s, c) => s + c.totalSizeBytes, 0) ?? 0;

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-primary-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <header className="flex items-center gap-3 px-6 py-4 border-b border-dark-700 flex-shrink-0">
                <BarChart3 size={22} className="text-primary-400" />
                <h2 className="text-lg font-semibold text-white">Resources</h2>
                <span className="text-xs text-slate-500">System Overview & Monitoring</span>
                <button
                    onClick={load}
                    disabled={loading}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </header>

            {error && (
                <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 text-sm rounded-lg">
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                </div>
            )}

            <div className="p-6 space-y-6">
                {/* ── Top Stats Cards ────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Brain size={20} />}
                        label="LLM Models"
                        value={String(data?.models.length ?? 0)}
                        sub={`${data?.models.filter(m => m.status === 'available').length ?? 0} available`}
                        color="blue"
                    />
                    <StatCard
                        icon={<Wrench size={20} />}
                        label="Tools"
                        value={String(data?.tools.total ?? 0)}
                        sub={`${data?.skills.total ?? 0} skills active`}
                        color="purple"
                    />
                    <StatCard
                        icon={<Database size={20} />}
                        label="KB Collections"
                        value={String(data?.knowledgeBase.totalCollections ?? 0)}
                        sub={`${totalKBDocs} documents`}
                        color="green"
                    />
                    <StatCard
                        icon={<Activity size={20} />}
                        label="Gateway"
                        value={String(data?.gateway.sessions ?? 0)}
                        sub={`Uptime: ${formatUptime(data?.gateway.uptime ?? 0)}`}
                        color="amber"
                    />
                </div>

                {/* ── Models Section ─────────────────────────────── */}
                <Section icon={<Cpu size={18} />} title="Registered Models">
                    {data?.models.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4 text-center">No models registered</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data?.models.map(model => (
                                <div key={model.id} className="flex items-center gap-3 px-4 py-3 bg-dark-800 rounded-lg">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${model.status === 'available' ? 'bg-green-400' :
                                            model.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                                        }`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">{model.name}</span>
                                            {model.is_default && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-primary-600/30 text-primary-300 rounded">default</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                            <span className="capitalize">{model.provider}</span>
                                            <span className="text-slate-600">•</span>
                                            <span className="truncate">{model.model_id}</span>
                                        </div>
                                    </div>
                                    <StatusBadge status={model.status} />
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* ── Knowledge Base Section ─────────────────────── */}
                <Section icon={<Database size={18} />} title="Knowledge Base">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        <MiniStat label="Collections" value={String(data?.knowledgeBase.totalCollections ?? 0)} />
                        <MiniStat label="Documents" value={String(totalKBDocs)} />
                        <MiniStat label="Chunks" value={totalKBChunks.toLocaleString()} />
                        <MiniStat label="Total Size" value={formatBytes(totalKBSize)} />
                    </div>
                    {data?.knowledgeBase.collections.length === 0 ? (
                        <p className="text-sm text-slate-500 py-2 text-center">No knowledge collections yet</p>
                    ) : (
                        <div className="space-y-2">
                            {data?.knowledgeBase.collections.map(col => (
                                <div key={col.collectionId} className="flex items-center gap-4 px-4 py-2.5 bg-dark-800 rounded-lg">
                                    <span className="text-sm font-medium text-white flex-1 truncate">{col.name}</span>
                                    <span className="text-xs text-slate-500">{col.documentCount} docs</span>
                                    <span className="text-xs text-slate-500">{col.chunkCount} chunks</span>
                                    <span className="text-xs text-slate-500">{col.totalTokens.toLocaleString()} tokens</span>
                                    <span className="text-xs text-slate-500">{formatBytes(col.totalSizeBytes)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* ── Skills & Tools Section ─────────────────────── */}
                <Section icon={<Layers size={18} />} title="Active Skills & Tools">
                    <div className="flex flex-wrap gap-2">
                        {data?.skills.active.map(skill => (
                            <span key={skill} className="px-3 py-1.5 bg-dark-800 rounded-lg text-sm text-slate-300 border border-dark-600">
                                <Zap size={12} className="inline mr-1.5 text-primary-400" />
                                {skill}
                            </span>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                        {data?.tools.total} tools available across {data?.skills.total} active skills
                    </p>
                </Section>

                {/* ── System Health ───────────────────────────────── */}
                <Section icon={<Server size={18} />} title="System Health">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <HealthCard
                            label="PostgreSQL"
                            status={data?.health && 'postgresql' in (data.health as Record<string, unknown>) ? 'ok' : 'unknown'}
                        />
                        <HealthCard
                            label="MongoDB"
                            status={data?.health && 'mongodb' in (data.health as Record<string, unknown>) ? 'ok' : 'unknown'}
                        />
                        <HealthCard
                            label="Ollama"
                            status={data?.health && 'ollama' in (data.health as Record<string, unknown>) ? 'ok' : 'unknown'}
                        />
                    </div>
                </Section>
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
    icon: React.ReactNode; label: string; value: string; sub: string;
    color: 'blue' | 'purple' | 'green' | 'amber';
}) {
    const colors = {
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        green: 'bg-green-500/10 text-green-400 border-green-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
    return (
        <div className={`rounded-xl border p-4 ${colors[color]}`}>
            <div className="flex items-center gap-2 mb-2 opacity-80">{icon}<span className="text-xs font-medium">{label}</span></div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs opacity-60 mt-0.5">{sub}</div>
        </div>
    );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-dark-850 border border-dark-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-primary-400">{icon}</span>
                <h3 className="text-white font-semibold">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-center px-2 py-2 bg-dark-900 rounded-lg">
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'available') return <span className="text-[11px] px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full">available</span>;
    if (status === 'error') return <span className="text-[11px] px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full">error</span>;
    return <span className="text-[11px] px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full">{status}</span>;
}

function HealthCard({ label, status }: { label: string; status: string }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-dark-800 rounded-lg">
            {status === 'ok' ? (
                <CheckCircle size={18} className="text-green-400" />
            ) : status === 'error' ? (
                <XCircle size={18} className="text-red-400" />
            ) : (
                <AlertTriangle size={18} className="text-yellow-400" />
            )}
            <span className="text-sm text-white font-medium">{label}</span>
            <span className={`ml-auto text-xs ${status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                {status === 'ok' ? 'Connected' : status === 'error' ? 'Error' : 'Unknown'}
            </span>
        </div>
    );
}
