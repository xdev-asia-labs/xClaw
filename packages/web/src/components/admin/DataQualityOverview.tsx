// ============================================================
// Data Quality Overview - Dashboard for learning data quality
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, StatCard, Tabs, Spinner, ErrorBanner } from '@/components/ui';
import {
    ShieldCheck, AlertTriangle, Clock, CheckCircle2,
    XCircle, BarChart3, TrendingUp,
} from 'lucide-react';
import {
    ResponsiveContainer, PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export function DataQualityOverview() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);

    const periodTabs = [
        { id: '7', label: '7 days' },
        { id: '14', label: '14 days' },
        { id: '30', label: '30 days' },
    ];

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.admin.getDataQuality(days);
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data quality');
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const statusData = stats ? [
        { name: 'Approved', value: stats.approved, color: COLORS[0] },
        { name: 'Pending', value: stats.pending, color: COLORS[1] },
        { name: 'Rejected', value: stats.rejected, color: COLORS[2] },
    ].filter(d => d.value > 0) : [];

    const approvalRate = stats?.total ? Math.round((stats.approved / stats.total) * 100) : 0;

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <PageHeader
                icon={ShieldCheck}
                title="Data Quality"
                subtitle="Learning data quality overview and metrics"
                onRefresh={load}
                refreshing={loading}
                actions={
                    <Tabs tabs={periodTabs} active={String(days)} onChange={(id: string) => setDays(Number(id))} />
                }
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {loading ? <Spinner /> : stats && (
                <div className="p-4 space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={BarChart3} label="Total Entries" value={stats.total} color="blue" />
                        <StatCard icon={CheckCircle2} label="Approved" value={stats.approved} color="green" />
                        <StatCard icon={Clock} label="Pending Review" value={stats.pending} color="yellow" />
                        <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="red" />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="p-4">
                            <h3 className="text-sm font-medium text-slate-300 mb-3">Approval Rate</h3>
                            <div className="flex items-center justify-center">
                                <div className="relative">
                                    <ResponsiveContainer width={200} height={200}>
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%" cy="50%"
                                                innerRadius={60} outerRadius={80}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {statusData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-white">{approvalRate}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center gap-4 mt-3">
                                {statusData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                        {d.name}: {d.value}
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card className="p-4">
                            <h3 className="text-sm font-medium text-slate-300 mb-3">By Type</h3>
                            {stats.byType && stats.byType.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={stats.byType}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[200px] text-sm text-slate-500">
                                    No data by type yet
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Quality Alerts */}
                    {stats.pending > 10 && (
                        <Card className="p-4 border-yellow-600/30">
                            <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                <AlertTriangle size={16} />
                                <span className="font-medium">High pending queue:</span> {stats.pending} entries awaiting review.
                            </div>
                        </Card>
                    )}

                    {approvalRate < 50 && stats.total > 5 && (
                        <Card className="p-4 border-red-600/30">
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertTriangle size={16} />
                                <span className="font-medium">Low approval rate ({approvalRate}%).</span>
                                Consider tuning auto-detection confidence threshold.
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
