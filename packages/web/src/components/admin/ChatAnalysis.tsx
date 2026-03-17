// ============================================================
// Chat Analysis - Per-doctor chat analysis & learning patterns
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, Tabs, StatCard, Spinner, ErrorBanner } from '@/components/ui';
import {
    MessageSquareText, Brain, TrendingUp, Activity,
    BarChart3, Users,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ChatAnalysis() {
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<string>('');
    const [analysis, setAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);

    const periodTabs = [
        { id: '7', label: '7 days' },
        { id: '14', label: '14 days' },
        { id: '30', label: '30 days' },
    ];

    const loadDoctors = useCallback(async () => {
        try {
            const { profiles } = await api.admin.getDoctors();
            setDoctors(profiles);
            if (profiles.length > 0 && !selectedDoctor) {
                setSelectedDoctor(profiles[0].id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load doctors');
        }
    }, []);

    const loadAnalysis = useCallback(async () => {
        if (!selectedDoctor) return;
        try {
            setLoading(true);
            setError(null);
            const data = await api.admin.getDoctorAnalysis(selectedDoctor, days);
            setAnalysis(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analysis');
        } finally {
            setLoading(false);
        }
    }, [selectedDoctor, days]);

    useEffect(() => { loadDoctors(); }, [loadDoctors]);
    useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

    const typeData = analysis?.learningByType ? Object.entries(analysis.learningByType).map(
        ([name, value]) => ({ name, value })
    ) : [];

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <PageHeader
                icon={MessageSquareText}
                title="Chat Analysis"
                subtitle="Per-doctor chat patterns and auto-learning insights"
                onRefresh={loadAnalysis}
                refreshing={loading}
                actions={
                    <Tabs tabs={periodTabs} active={String(days)} onChange={(id: string) => setDays(Number(id))} />
                }
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="p-4 space-y-4">
                {/* Doctor selector */}
                <div className="flex items-center gap-3">
                    <Users size={14} className="text-slate-400" />
                    <select
                        value={selectedDoctor}
                        onChange={e => setSelectedDoctor(e.target.value)}
                        className="bg-dark-800 border border-dark-600 rounded px-3 py-1.5 text-sm text-white"
                    >
                        <option value="">Select doctor</option>
                        {doctors.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.hospital || 'Unknown'} — {(d.specialty || []).join(', ') || 'General'}
                            </option>
                        ))}
                    </select>
                </div>

                {!selectedDoctor ? (
                    <div className="text-center text-sm text-slate-500 py-12">Select a doctor to view analysis.</div>
                ) : loading ? <Spinner /> : analysis && (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard icon={MessageSquareText} label="Total Chats" value={analysis.totalChats ?? 0} color="blue" />
                            <StatCard icon={Activity} label="Total Messages" value={analysis.totalMessages ?? 0} color="green" />
                            <StatCard icon={Brain} label="Learning Extracted" value={analysis.learningCount ?? 0} color="purple" />
                            <StatCard icon={TrendingUp} label="Avg Confidence" value={`${((analysis.avgConfidence ?? 0) * 100).toFixed(0)}%`} color="yellow" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Learning by type pie */}
                            <Card className="p-4">
                                <h3 className="text-sm font-medium text-slate-300 mb-3">Learning by Type</h3>
                                {typeData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <PieChart>
                                            <Pie data={typeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                                                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px] text-sm text-slate-500">
                                        No learning data yet
                                    </div>
                                )}
                            </Card>

                            {/* Daily activity */}
                            <Card className="p-4">
                                <h3 className="text-sm font-medium text-slate-300 mb-3">Daily Activity</h3>
                                {analysis.dailyVolume?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={analysis.dailyVolume.map((d: any) => ({ ...d, label: d.date?.slice(5) }))}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                                            <Bar dataKey="messages" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Messages" />
                                            <Bar dataKey="learning" fill="#10b981" radius={[4, 4, 0, 0]} name="Learning" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px] text-sm text-slate-500">
                                        No daily data yet
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* Top topics / categories */}
                        {analysis.topCategories?.length > 0 && (
                            <Card className="p-4">
                                <h3 className="text-sm font-medium text-slate-300 mb-3">Top Categories</h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.topCategories.map((cat: any, i: number) => (
                                        <span key={i} className="text-xs px-2.5 py-1 bg-dark-700 text-slate-300 rounded-full">
                                            {cat.category} <span className="text-slate-500">({cat.count})</span>
                                        </span>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Recent learning entries */}
                        {analysis.recentLearning?.length > 0 && (
                            <Card className="p-4">
                                <h3 className="text-sm font-medium text-slate-300 mb-3">Recent Auto-Extracted Learning</h3>
                                <div className="space-y-2">
                                    {analysis.recentLearning.slice(0, 5).map((entry: any, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            <span className="text-slate-500 mt-0.5 capitalize shrink-0">{entry.type}</span>
                                            <span className="text-slate-300">{entry.content}</span>
                                            <span className="text-slate-600 shrink-0">
                                                {(entry.confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
