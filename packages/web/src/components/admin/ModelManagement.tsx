// ============================================================
// ModelManagement - LLM model registry & Ollama management
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, Badge, StatusDot, EmptyState, ErrorBanner, Spinner, Button, Tabs } from '@/components/ui';
import { Brain, Server, Cpu, Star, Trash2, Download, RefreshCw } from 'lucide-react';

interface RegisteredModel {
    id: string;
    name: string;
    provider: string;
    model_id: string;
    status: string;
    is_default: boolean;
}

interface OllamaModel {
    name: string;
    size: number;
    digest: string;
    modified_at: string;
}

export function ModelManagement() {
    const [tab, setTab] = useState('registered');
    const [models, setModels] = useState<RegisteredModel[]>([]);
    const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [reg, ollama] = await Promise.all([
                api.getModels().catch(() => ({ models: [] })),
                api.getOllamaModels().catch(() => ({ models: [] })),
            ]);
            setModels(reg.models ?? []);
            setOllamaModels(ollama.models ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load models');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const formatSize = (bytes: number) => {
        if (!bytes) return '—';
        const gb = bytes / (1024 ** 3);
        return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
    };

    const tabs = [
        { id: 'registered', label: 'Registered Models', icon: <Brain size={14} />, count: models.length },
        { id: 'ollama', label: 'Ollama Models', icon: <Server size={14} />, count: ollamaModels.length },
    ];

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="px-6 pt-5">
                <PageHeader
                    icon={Cpu}
                    title="Model Management"
                    subtitle="LLM model registry and local model management"
                    actions={
                        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
                            <RefreshCw size={14} /> Refresh
                        </Button>
                    }
                />
            </div>

            {error && <div className="px-6 mt-3"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}

            <div className="px-6 pt-4">
                <Tabs tabs={tabs} active={tab} onChange={setTab} />
            </div>

            <div className="flex-1 px-6 py-4">
                {loading && !models.length ? (
                    <div className="flex justify-center py-12"><Spinner size={24} /></div>
                ) : tab === 'registered' ? (
                    models.length === 0 ? (
                        <EmptyState icon={Brain} title="No models registered" description="Configure models in Settings to get started." />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {models.map(m => (
                                <Card key={m.id} className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <StatusDot status={m.status === 'available' ? 'healthy' : m.status === 'error' ? 'unhealthy' : 'warning'} />
                                            <span className="text-sm font-semibold text-white">{m.name}</span>
                                        </div>
                                        {m.is_default && (
                                            <Badge variant="info"><Star size={10} className="mr-1" />Default</Badge>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-400">
                                        <div className="flex justify-between">
                                            <span>Provider</span>
                                            <span className="text-slate-300 capitalize">{m.provider}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Model ID</span>
                                            <span className="text-slate-300 font-mono text-[11px] truncate max-w-[180px]">{m.model_id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Status</span>
                                            <Badge variant={m.status === 'available' ? 'success' : m.status === 'error' ? 'danger' : 'warning'}>
                                                {m.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )
                ) : (
                    ollamaModels.length === 0 ? (
                        <EmptyState icon={Server} title="No Ollama models" description="Pull models using Ollama CLI or the agent." />
                    ) : (
                        <div className="space-y-2">
                            {ollamaModels.map(m => (
                                <Card key={m.digest} className="px-4 py-3 flex items-center gap-4">
                                    <Download size={16} className="text-primary-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-white">{m.name}</span>
                                        <span className="text-xs text-slate-500 ml-3">{formatSize(m.size)}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-600 font-mono">{m.digest?.slice(0, 12)}</span>
                                </Card>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
