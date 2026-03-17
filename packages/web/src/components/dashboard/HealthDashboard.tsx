// ============================================================
// HealthDashboard - Healthcare monitoring overview
// ============================================================

import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import {
    Activity, HeartPulse, Pill, Calendar, TrendingUp,
    AlertTriangle, RefreshCw,
} from 'lucide-react';

interface HealthMetric {
    type: string;
    value: number;
    unit: string;
    timestamp: string;
    notes?: string;
}

export function HealthDashboard() {
    const [metrics, setMetrics] = useState<HealthMetric[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.searchMemory('health metrics', 50);
            setMetrics(
                (res.results || [])
                    .filter((r: any) => r.tags?.includes('health'))
                    .map((r: any) => r.metadata ?? r)
            );
        } catch {
            // silently fail if backend isn't running
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const cards = [
        { icon: HeartPulse, label: 'Heart Rate', color: 'text-red-400', bg: 'bg-red-500/10', type: 'heart_rate', unit: 'bpm' },
        { icon: Activity, label: 'Blood Pressure', color: 'text-blue-400', bg: 'bg-blue-500/10', type: 'blood_pressure', unit: 'mmHg' },
        { icon: TrendingUp, label: 'Blood Sugar', color: 'text-amber-400', bg: 'bg-amber-500/10', type: 'blood_sugar', unit: 'mg/dL' },
        { icon: Pill, label: 'Medications', color: 'text-green-400', bg: 'bg-green-500/10', type: 'medication', unit: '' },
        { icon: Calendar, label: 'Appointments', color: 'text-purple-400', bg: 'bg-purple-500/10', type: 'appointment', unit: '' },
        { icon: AlertTriangle, label: 'Alerts', color: 'text-orange-400', bg: 'bg-orange-500/10', type: 'alert', unit: '' },
    ];

    const getCardValue = (type: string, unit: string): string => {
        const matched = metrics.filter(m => m.type === type);
        if (matched.length === 0) return '--';
        if (type === 'medication' || type === 'appointment' || type === 'alert') return String(matched.length);
        const latest = matched[matched.length - 1];
        return `${latest.value}${unit ? ' ' + unit : ''}`;
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Health Dashboard</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Monitor your health metrics and medical information
                        </p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 transition disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {cards.map(card => (
                        <div
                            key={card.label}
                            className={`${card.bg} border border-dark-700 rounded-xl p-4`}
                        >
                            <card.icon size={24} className={card.color} />
                            <p className="text-xs text-slate-400 mt-2">{card.label}</p>
                            <p className="text-lg font-bold text-white mt-0.5">{getCardValue(card.type, card.unit)}</p>
                        </div>
                    ))}
                </div>

                {/* Info Banner */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 text-center">
                    <Activity size={48} className="text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                        Healthcare Module Active
                    </h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                        Use the chat to interact with healthcare tools: log metrics, check medications,
                        manage appointments, and analyze symptoms. Data will appear here.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {[
                            'symptom_analyze', 'health_metrics_log', 'medication_check_interaction',
                            'appointment_manage', 'health_report',
                        ].map(tool => (
                            <span
                                key={tool}
                                className="px-3 py-1 bg-dark-700 rounded-full text-xs text-slate-300 font-mono"
                            >
                                {tool}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300">
                            <strong>Medical Disclaimer:</strong> This AI assistant provides general health information only.
                            It is NOT a substitute for professional medical advice, diagnosis, or treatment.
                            Always consult your healthcare provider for medical decisions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
