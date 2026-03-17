// ============================================================
// Learning Data Review - Review auto-extracted learning entries
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, Tabs, Spinner, ErrorBanner } from '@/components/ui';
import {
    BookOpen, CheckCircle, XCircle, Clock, Eye,
    Filter, ChevronLeft, ChevronRight,
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

export function LearningDataReview() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('auto_detected');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(0);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [doctorFilter, setDoctorFilter] = useState('');

    const statusTabs = [
        { id: 'auto_detected', label: 'Pending' },
        { id: 'doctor_confirmed', label: 'Doctor OK' },
        { id: 'admin_verified', label: 'Verified' },
        { id: 'rejected', label: 'Rejected' },
        { id: '', label: 'All' },
    ];

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [{ entries: e }, { profiles }] = await Promise.all([
                api.admin.getLearning({
                    status: statusFilter || undefined,
                    type: typeFilter || undefined,
                    doctor_id: doctorFilter || undefined,
                    limit: PAGE_SIZE,
                    offset: page * PAGE_SIZE,
                }),
                api.admin.getDoctors(),
            ]);
            setEntries(e);
            setDoctors(profiles);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, typeFilter, doctorFilter, page]);

    useEffect(() => { load(); }, [load]);

    const handleStatus = async (id: string, status: string) => {
        try {
            await api.admin.updateLearningStatus(id, status);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update status');
        }
    };

    const getDoctorLabel = (doctorId: string) => {
        const d = doctors.find(p => p.id === doctorId);
        return d ? (d.hospital || d.user_id?.slice(0, 8)) : doctorId?.slice(0, 8);
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <PageHeader
                icon={BookOpen}
                title="Learning Data Review"
                subtitle="Review and approve auto-extracted learning entries"
                onRefresh={load}
                refreshing={loading}
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="p-4 space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <Tabs tabs={statusTabs} active={statusFilter} onChange={(id: string) => { setStatusFilter(id); setPage(0); }} />

                    <select
                        value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                        className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-white"
                    >
                        <option value="">All types</option>
                        <option value="preference">Preference</option>
                        <option value="correction">Correction</option>
                        <option value="knowledge">Knowledge</option>
                        <option value="decision_pattern">Decision Pattern</option>
                    </select>

                    {doctors.length > 0 && (
                        <select
                            value={doctorFilter} onChange={e => { setDoctorFilter(e.target.value); setPage(0); }}
                            className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-white"
                        >
                            <option value="">All doctors</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>{d.hospital || d.user_id?.slice(0, 8)}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Entries */}
                {loading ? <Spinner /> : entries.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 py-12">
                        No learning entries matching filters.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {entries.map(entry => (
                            <Card key={entry.id} className="overflow-hidden">
                                <div
                                    className="p-3 cursor-pointer hover:bg-dark-700/50 transition"
                                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm">{TYPE_ICONS[entry.type] || '📝'}</span>
                                                <span className="text-xs font-medium text-white capitalize">{entry.type.replace('_', ' ')}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[entry.status]}`}>
                                                    {entry.status.replace('_', ' ')}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    conf: {(entry.confidence * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-300 line-clamp-2">{entry.content}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-500">
                                                    Doctor: {getDoctorLabel(entry.doctor_id)}
                                                </span>
                                                {entry.tags?.length > 0 && entry.tags.map((t: string, i: number) => (
                                                    <span key={i} className="text-[10px] px-1 py-0.5 bg-dark-600 text-slate-400 rounded">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {expandedId === entry.id && (
                                    <div className="border-t border-dark-600 p-3 bg-dark-800/50 space-y-3">
                                        <div>
                                            <span className="text-xs text-slate-500">Full Content</span>
                                            <p className="text-xs text-white mt-1 bg-dark-900 rounded p-2 whitespace-pre-wrap">{entry.content}</p>
                                        </div>
                                        {entry.context && (
                                            <div>
                                                <span className="text-xs text-slate-500">Context</span>
                                                <p className="text-xs text-slate-300 mt-1 bg-dark-900 rounded p-2 whitespace-pre-wrap">{entry.context}</p>
                                            </div>
                                        )}
                                        <div className="text-[10px] text-slate-500">
                                            Source: conversation {entry.source_conversation_id?.slice(0, 8) || '–'} ·
                                            Created: {new Date(entry.created_at).toLocaleString()}
                                        </div>
                                        <div className="flex gap-2">
                                            {entry.status !== 'admin_verified' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleStatus(entry.id, 'admin_verified'); }}
                                                    className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition">
                                                    <CheckCircle size={12} /> Verify
                                                </button>
                                            )}
                                            {entry.status !== 'rejected' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleStatus(entry.id, 'rejected'); }}
                                                    className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition">
                                                    <XCircle size={12} /> Reject
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {entries.length > 0 && (
                    <div className="flex items-center justify-between pt-2">
                        <button
                            disabled={page === 0} onClick={() => setPage(p => p - 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition"
                        >
                            <ChevronLeft size={14} /> Previous
                        </button>
                        <span className="text-xs text-slate-500">Page {page + 1}</span>
                        <button
                            disabled={entries.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition"
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
