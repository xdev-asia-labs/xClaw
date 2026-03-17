import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, StatCard, Badge, StatusDot, ErrorBanner, EmptyState, Spinner } from '@/components/ui';
import { formatUptime, formatBytes } from '@/utils/format';
import {
    BarChart3, Cpu, Database, Layers, Activity,
    Server, Zap, CheckCircle, XCircle,
    AlertTriangle, Wrench, Brain,
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

    const totalKBDocs = data?.knowledgeBase.collections.reduce((s, c) => s + c.documentCount, 0) ?? 0;
    const totalKBChunks = data?.knowledgeBase.collections.reduce((s, c) => s + c.chunkCount, 0) ?? 0;
    const totalKBTokens = data?.knowledgeBase.collections.reduce((s, c) => s + c.totalTokens, 0) ?? 0;
    const totalKBSize = data?.knowledgeBase.collections.reduce((s, c) => s + c.totalSizeBytes, 0) ?? 0;

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner size={24} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="px-6 pt-5">
                <PageHeader
                    icon={BarChart3}
                    title="Resources"
                    subtitle="System Overview & Monitoring"
                    onRefresh={load}
                    refreshing={loading}
                />
            </div>

            {error && (
                <div className="px-6 mt-3">
                    <ErrorBanner message={error} onDismiss={() => setError(null)} />
                </div>
            )}

            <div className="p-6 space-y-6">
                {/* ── Top Stats Cards ────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Brain} label="LLM Models" value={String(data?.models.length ?? 0)} change={`${data?.models.filter(m => m.status === 'available').length ?? 0} available`} />
                    <StatCard icon={Wrench} label="Tools" value={String(data?.tools.total ?? 0)} change={`${data?.skills.total ?? 0} skills active`} />
                    <StatCard icon={Database} label="KB Collections" value={String(data?.knowledgeBase.totalCollections ?? 0)} change={`${totalKBDocs} documents`} />
                    <StatCard icon={Activity} label="Gateway" value={String(data?.gateway.sessions ?? 0)} change={`Uptime: ${formatUptime(data?.gateway.uptime ?? 0)}`} />
                </div>

                {/* ── Models Section ─────────────────────────────── */}
                <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Cpu size={18} className="text-primary-400" />
                        <h3 className="text-white font-semibold">Registered Models</h3>
                    </div>
                    {data?.models.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4 text-center">No models registered</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data?.models.map(model => (
                                <div key={model.id} className="flex items-center gap-3 px-4 py-3 bg-dark-800 rounded-lg">
                                    <StatusDot status={model.status === 'available' ? 'healthy' : model.status === 'error' ? 'unhealthy' : 'warning'} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">{model.name}</span>
                                            {model.is_default && (
                                                <Badge variant="info">default</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                            <span className="capitalize">{model.provider}</span>
                                            <span className="text-slate-600">•</span>
                                            <span className="truncate">{model.model_id}</span>
                                        </div>
                                    </div>
                                    <Badge variant={model.status === 'available' ? 'success' : model.status === 'error' ? 'danger' : 'warning'}>{model.status}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* ── Knowledge Base Section ─────────────────────── */}
                <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Database size={18} className="text-primary-400" />
                        <h3 className="text-white font-semibold">Knowledge Base</h3>
                    </div>
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
                </Card>

                {/* ── Skills & Tools Section ─────────────────────── */}
                <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers size={18} className="text-primary-400" />
                        <h3 className="text-white font-semibold">Active Skills & Tools</h3>
                    </div>
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
                </Card>

                {/* ── System Health ───────────────────────────────── */}
                <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Server size={18} className="text-primary-400" />
                        <h3 className="text-white font-semibold">System Health</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <HealthCard label="PostgreSQL" status={data?.health && 'postgresql' in (data.health as Record<string, unknown>) ? 'ok' : 'unknown'} />
                        <HealthCard label="MongoDB" status={data?.health && 'mongodb' in (data.health as Record<string, unknown>) ? 'ok' : 'unknown'} />
                        <HealthCard label="Ollama" status={data?.health && 'ollama' in (data.health as Record<string, unknown>) ? 'ok' : 'unknown'} />
                    </div>
                </Card>
            </div>
        </div>
    );
}

// ─── Sub-components (kept local - specific to this page) ─────

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-center px-2 py-2 bg-dark-900 rounded-lg">
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
        </div>
    );
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
            <span className={`ml-auto text-xs ${status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                {status === 'ok' ? 'Connected' : status === 'error' ? 'Error' : 'Unknown'}
            </span>
        </div>
    );
}
