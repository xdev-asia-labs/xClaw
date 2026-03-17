// ============================================================
// Analytics - Usage statistics, charts, and export (recharts)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, StatCard, Tabs, Spinner, ErrorBanner } from '@/components/ui';
import { formatNumber } from '@/utils/format';
import {
    TrendingUp, MessageSquare, Users, Database,
    Clock, Zap, Download, FileSpreadsheet, FileText,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line,
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend,
} from 'recharts';

interface ReportSummary {
    period: string;
    totalChats: number;
    totalMessages: number;
    totalTokensUsed: number;
    avgResponseLatencyMs: number;
    activeUsers: number;
    newUsers: number;
    topUsers: { username: string; displayName: string; messageCount: number }[];
    dailyVolume: { date: string; chats: number; messages: number }[];
    modelUsage: { model: string; count: number }[];
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function Analytics() {
    const [data, setData] = useState<ReportSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(14);
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
    const [exporting, setExporting] = useState<string | null>(null);

    const periodTabs = [
        { id: '7', label: '7 days' },
        { id: '14', label: '14 days' },
        { id: '30', label: '30 days' },
    ];

    const chartTabs = [
        { id: 'bar', label: 'Bar' },
        { id: 'line', label: 'Line' },
    ];

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const summary = await api.admin.getReportSummary(days);
            setData(summary);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const handleExport = async (format: 'markdown' | 'excel' | 'pdf') => {
        try {
            setExporting(format);
            if (format === 'excel' || format === 'pdf') {
                const blob = await api.admin.exportReportBlob('summary', days, format);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `report-summary-${days}d.${format === 'excel' ? 'xlsx' : 'pdf'}`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const text = await api.admin.exportReport('summary', days, 'markdown');
                const blob = new Blob([typeof text === 'string' ? text : JSON.stringify(text, null, 2)], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `report-summary-${days}d.md`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch {
            setError('Failed to export report');
        } finally {
            setExporting(null);
        }
    };

    // Format daily volume dates for chart axis
    const chartData = data?.dailyVolume.map(d => ({ ...d, label: d.date.slice(5) })) ?? [];

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <PageHeader
                icon={TrendingUp}
                title="Analytics"
                subtitle="Usage statistics, charts, and exports"
                onRefresh={load}
                refreshing={loading}
                actions={
                    <div className="flex items-center gap-3">
                        <Tabs tabs={periodTabs} active={String(days)} onChange={(id) => setDays(Number(id))} />
                        {/* Export dropdown */}
                        <div className="relative group">
                            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition border border-dark-600">
                                <Download size={12} /> Export
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-44 bg-dark-800 border border-dark-600 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                <button onClick={() => handleExport('excel')} disabled={!!exporting}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-dark-700 rounded-t-lg transition">
                                    <FileSpreadsheet size={14} className="text-green-400" />
                                    {exporting === 'excel' ? 'Exporting...' : 'Excel (.xlsx)'}
                                </button>
                                <button onClick={() => handleExport('pdf')} disabled={!!exporting}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-dark-700 transition">
                                    <FileText size={14} className="text-red-400" />
                                    {exporting === 'pdf' ? 'Exporting...' : 'PDF (.pdf)'}
                                </button>
                                <button onClick={() => handleExport('markdown')} disabled={!!exporting}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-dark-700 rounded-b-lg transition">
                                    <Download size={14} className="text-blue-400" />
                                    {exporting === 'markdown' ? 'Exporting...' : 'Markdown (.md)'}
                                </button>
                            </div>
                        </div>
                    </div>
                }
            />

            {error && <div className="px-6 mt-3"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}

            {loading && !data ? (
                <div className="flex justify-center py-16"><Spinner size={24} /></div>
            ) : data && (
                <div className="p-6 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <StatCard icon={MessageSquare} label="Conversations" value={formatNumber(data.totalChats)} />
                        <StatCard icon={Database} label="Messages" value={formatNumber(data.totalMessages)} />
                        <StatCard icon={Users} label="Active Users" value={formatNumber(data.activeUsers)} />
                        <StatCard icon={Zap} label="Tokens Used" value={formatNumber(data.totalTokensUsed)} />
                        <StatCard icon={Clock} label="Avg Latency" value={data.avgResponseLatencyMs > 0 ? `${(data.avgResponseLatencyMs / 1000).toFixed(1)}s` : '—'} />
                    </div>

                    {/* Daily Volume Chart */}
                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <TrendingUp size={16} className="text-primary-400" /> Daily Volume
                            </h3>
                            <Tabs tabs={chartTabs} active={chartType} onChange={(id) => setChartType(id as 'bar' | 'line')} />
                        </div>
                        {chartData.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">No data for this period</p>
                        ) : (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartType === 'bar' ? (
                                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                                                labelStyle={{ color: '#e2e8f0' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Bar dataKey="messages" name="Messages" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="chats" name="Conversations" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    ) : (
                                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                                                labelStyle={{ color: '#e2e8f0' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Line type="monotone" dataKey="messages" name="Messages" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                            <Line type="monotone" dataKey="chats" name="Conversations" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Top Users - horizontal bar */}
                        <Card className="p-5">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Users size={16} className="text-emerald-400" /> Most Active Users
                            </h3>
                            {data.topUsers.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-6">No user activity yet</p>
                            ) : (
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={data.topUsers.slice(0, 8).map(u => ({ name: u.displayName, messages: u.messageCount }))}
                                            layout="vertical"
                                            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                            <Bar dataKey="messages" name="Messages" fill="#10b981" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>

                        {/* Model Usage - Pie chart */}
                        <Card className="p-5">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                <Zap size={16} className="text-amber-400" /> Model Usage
                            </h3>
                            {data.modelUsage.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-6">No model data yet</p>
                            ) : (
                                <div className="h-56 flex items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.modelUsage.map(m => ({ name: m.model, value: m.count }))}
                                                cx="50%" cy="50%"
                                                innerRadius={45} outerRadius={75}
                                                paddingAngle={3}
                                                dataKey="value"
                                                label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                                                labelLine={{ stroke: '#64748b' }}
                                            >
                                                {data.modelUsage.map((_, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
