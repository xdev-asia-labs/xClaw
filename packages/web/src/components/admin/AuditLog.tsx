// ============================================================
// AuditLog - System activity log viewer
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Badge, EmptyState, Spinner, ErrorBanner, SearchInput, Tabs } from '@/components/ui';
import { formatDate } from '@/utils/format';
import {
    ScrollText, Shield, MessageSquare, Database, Key,
    Users, Settings, LogIn, LogOut, Filter,
} from 'lucide-react';

interface AuditEntry {
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    resource: string;
    details?: string;
    ip?: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    auth: LogIn,
    chat: MessageSquare,
    knowledge: Database,
    admin: Shield,
    api: Key,
    user: Users,
    settings: Settings,
};

const BADGE_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    login: 'info',
    logout: 'default',
    create: 'success',
    delete: 'danger',
    update: 'warning',
    view: 'default',
};

// Static demo data — replace with real API call when backend supports it
function generateDemoAudit(): AuditEntry[] {
    const actions = [
        { action: 'login', resource: 'auth', actor: 'admin', details: 'Logged in from web' },
        { action: 'create', resource: 'knowledge', actor: 'admin', details: 'Created collection "Company Docs"' },
        { action: 'create', resource: 'api', actor: 'admin', details: 'Generated API key "Production"' },
        { action: 'update', resource: 'settings', actor: 'admin', details: 'Updated LLM provider to ollama' },
        { action: 'delete', resource: 'knowledge', actor: 'admin', details: 'Deleted document "old-spec.md"' },
        { action: 'create', resource: 'user', actor: 'system', details: 'New user registered: demo_user' },
        { action: 'login', resource: 'auth', actor: 'demo_user', details: 'Logged in from embed widget' },
        { action: 'view', resource: 'chat', actor: 'demo_user', details: 'Chat session started' },
    ];
    const now = Date.now();
    return actions.map((a, i) => ({
        id: `audit-${i}`,
        timestamp: new Date(now - i * 3600000 * (1 + Math.random() * 5)).toISOString(),
        ...a,
    }));
}

export function AuditLog() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [category, setCategory] = useState('all');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            // TODO: Replace with actual API when backend supports audit log
            await new Promise(r => setTimeout(r, 400));
            setEntries(generateDemoAudit());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audit log');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const categories = [
        { id: 'all', label: 'All' },
        { id: 'auth', label: 'Auth' },
        { id: 'knowledge', label: 'Knowledge' },
        { id: 'admin', label: 'Admin' },
        { id: 'chat', label: 'Chat' },
        { id: 'api', label: 'API' },
    ];

    const filtered = entries.filter(e => {
        if (category !== 'all' && e.resource !== category) return false;
        if (filter && !e.details?.toLowerCase().includes(filter.toLowerCase()) && !e.actor.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="px-6 pt-5">
                <PageHeader
                    icon={ScrollText}
                    title="Audit Log"
                    subtitle="System activity and security events"
                    onRefresh={load}
                    refreshing={loading}
                />
            </div>

            {error && <div className="px-6 mt-3"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}

            <div className="px-6 pt-4 flex items-center gap-3">
                <Tabs tabs={categories} active={category} onChange={setCategory} />
                <SearchInput placeholder="Filter by actor or details..." onSearch={setFilter} className="w-64 ml-auto" />
            </div>

            <div className="flex-1 px-6 py-4">
                {loading ? (
                    <div className="flex justify-center py-12"><Spinner size={24} /></div>
                ) : filtered.length === 0 ? (
                    <EmptyState icon={ScrollText} title="No audit entries" description="Activity will appear here as users interact with the system." />
                ) : (
                    <div className="space-y-1">
                        {filtered.map(entry => {
                            const Icon = CATEGORY_ICONS[entry.resource] ?? Shield;
                            return (
                                <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-dark-800/50 transition group">
                                    <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center shrink-0">
                                        <Icon size={14} className="text-slate-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-white font-medium">{entry.actor}</span>
                                            <Badge variant={BADGE_VARIANT[entry.action] ?? 'default'}>{entry.action}</Badge>
                                            <span className="text-xs text-slate-500">{entry.resource}</span>
                                        </div>
                                        {entry.details && <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.details}</p>}
                                    </div>
                                    <span className="text-[11px] text-slate-600 shrink-0">{formatDate(entry.timestamp)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
