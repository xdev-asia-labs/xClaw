// ============================================================
// MyLearning - Doctor's self-service learning data view
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, Tabs, StatCard, Spinner, ErrorBanner } from '@/components/ui';
import {
    Brain, CheckCircle, XCircle, Clock, BookOpen,
    ChevronLeft, ChevronRight, TrendingUp,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
    auto_detected: 'bg-yellow-600/20 text-yellow-400',
    doctor_confirmed: 'bg-blue-600/20 text-blue-400',
    admin_verified: 'bg-green-600/20 text-green-400',
    rejected: 'bg-red-600/20 text-red-400',
};

const TYPE_ICONS: Record<string, string> = {
    preference: '🎯',
    correction: '✏️',
    knowledge: '📚',
    decision_pattern: '🔀',
};

const PAGE_SIZE = 20;

export function MyLearning() {
    const [profile, setProfile] = useState<any>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [analysis, setAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const [tab, setTab] = useState<'entries' | 'insights'>('entries');

    const statusTabs = [
        { id: '', label: 'All' },
        { id: 'auto_detected', label: 'Pending' },
        { id: 'doctor_confirmed', label: 'Confirmed' },
        { id: 'admin_verified', label: 'Verified' },
    ];

    const viewTabs = [
        { id: 'entries', label: 'Learning Entries' },
        { id: 'insights', label: 'Insights' },
    ];

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [prof, { entries: e }, anal] = await Promise.all([
                api.doctor.getProfile().catch(() => null),
                api.doctor.getLearning({
                    status: statusFilter || undefined,
                    limit: PAGE_SIZE,
                    offset: page * PAGE_SIZE,
                }),
                api.doctor.getAnalysis(30).catch(() => null),
            ]);
            setProfile(prof);
            setEntries(e);
            setAnalysis(anal);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load learning data');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, page]);

    useEffect(() => { load(); }, [load]);

    const handleConfirm = async (id: string, status: 'doctor_confirmed' | 'rejected') => {
        try {
            await api.doctor.confirmLearning(id, status);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
        }
    };

    if (!loading && !profile) {
        return (
            <div className="flex flex-col h-full">
                <PageHeader icon={Brain} title="My Learning" subtitle="AI personalization from your conversations" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-sm text-slate-500">
                        <Brain size={32} className="mx-auto mb-3 text-slate-600" />
                        No doctor profile found. Contact admin to set up your profile.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <PageHeader
                icon={Brain}
                title="My Learning"
                subtitle={profile ? `${(profile.specialty || []).join(', ')} · ${profile.hospital || 'Unknown'}` : 'AI learns from your conversations'}
                onRefresh={load}
                refreshing={loading}
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="p-4 space-y-4">
                {loading ? <Spinner /> : (
                    <>
                        {/* Summary */}
                        {analysis && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard icon={BookOpen} label="Total Entries" value={analysis.learningCount ?? 0} color="blue" />
                                <StatCard icon={TrendingUp} label="Avg Confidence" value={`${((analysis.avgConfidence ?? 0) * 100).toFixed(0)}%`} color="green" />
                                <StatCard icon={Clock} label="Pending Review" value={entries.filter(e => e.status === 'auto_detected').length} color="yellow" />
                                <StatCard icon={CheckCircle} label="Confirmed" value={entries.filter(e => e.status === 'doctor_confirmed').length} color="emerald" />
                            </div>
                        )}

                        <Tabs tabs={viewTabs} active={tab} onChange={(id: string) => setTab(id as 'entries' | 'insights')} />

                        {tab === 'entries' && (
                            <>
                                <Tabs tabs={statusTabs} active={statusFilter} onChange={(id: string) => { setStatusFilter(id); setPage(0); }} />

                                {entries.length === 0 ? (
                                    <div className="text-center text-sm text-slate-500 py-12">
                                        No learning entries yet. Keep chatting and the AI will learn your patterns!
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {entries.map(entry => (
                                            <Card key={entry.id} className="p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span>{TYPE_ICONS[entry.type] || '📝'}</span>
                                                            <span className="text-xs font-medium text-white capitalize">{entry.type.replace('_', ' ')}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[entry.status]}`}>
                                                                {entry.status.replace(/_/g, ' ')}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500">
                                                                {(entry.confidence * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-300">{entry.content}</p>
                                                        {entry.tags?.length > 0 && (
                                                            <div className="flex gap-1 mt-1.5">
                                                                {entry.tags.map((t: string, i: number) => (
                                                                    <span key={i} className="text-[10px] px-1 py-0.5 bg-dark-600 text-slate-400 rounded">{t}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <span className="text-[10px] text-slate-600 mt-1 block">
                                                            {new Date(entry.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    {entry.status === 'auto_detected' && (
                                                        <div className="flex gap-1 shrink-0">
                                                            <button onClick={() => handleConfirm(entry.id, 'doctor_confirmed')}
                                                                className="p-1.5 text-green-400 hover:bg-green-600/20 rounded transition" title="Confirm">
                                                                <CheckCircle size={16} />
                                                            </button>
                                                            <button onClick={() => handleConfirm(entry.id, 'rejected')}
                                                                className="p-1.5 text-red-400 hover:bg-red-600/20 rounded transition" title="Reject">
                                                                <XCircle size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {entries.length > 0 && (
                                    <div className="flex items-center justify-between pt-2">
                                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition">
                                            <ChevronLeft size={14} /> Previous
                                        </button>
                                        <span className="text-xs text-slate-500">Page {page + 1}</span>
                                        <button disabled={entries.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition">
                                            Next <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {tab === 'insights' && analysis && (
                            <div className="space-y-4">
                                {analysis.topCategories?.length > 0 && (
                                    <Card className="p-4">
                                        <h3 className="text-sm font-medium text-slate-300 mb-3">Your Top Topics</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {analysis.topCategories.map((cat: any, i: number) => (
                                                <span key={i} className="text-xs px-2.5 py-1 bg-blue-600/20 text-blue-300 rounded-full">
                                                    {cat.category} <span className="text-blue-500">({cat.count})</span>
                                                </span>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                <Card className="p-4">
                                    <h3 className="text-sm font-medium text-slate-300 mb-3">How It Works</h3>
                                    <div className="space-y-2 text-xs text-slate-400">
                                        <p>🎯 <strong className="text-slate-300">Preferences</strong> — When you say things like "I prefer..." or "always use...", the AI remembers.</p>
                                        <p>✏️ <strong className="text-slate-300">Corrections</strong> — When you correct the AI's response, it learns the right answer.</p>
                                        <p>📚 <strong className="text-slate-300">Knowledge</strong> — Domain-specific information you share gets captured.</p>
                                        <p>🔀 <strong className="text-slate-300">Decision Patterns</strong> — Your clinical decision patterns ("in this case, I choose...") are recorded.</p>
                                        <p className="mt-3 text-slate-500">
                                            Auto-detected entries are shown here for your review. Confirm or reject them to improve accuracy.
                                        </p>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
