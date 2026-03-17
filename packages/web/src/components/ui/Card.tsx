import React from 'react';
import type { LucideIcon } from 'lucide-react';

// ── Card ────────────────────────────────────────────────────

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
    return (
        <div className={`bg-dark-800 border border-dark-700 rounded-xl ${padding ? 'p-5' : ''} ${className}`}>
            {children}
        </div>
    );
}

// ── StatCard ────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    iconColor?: string;
    change?: string;
    changeType?: 'up' | 'down' | 'neutral';
    className?: string;
}

export function StatCard({ label, value, icon: Icon, iconColor = 'text-primary-400', change, changeType = 'neutral', className = '' }: StatCardProps) {
    const changeColors = { up: 'text-green-400', down: 'text-red-400', neutral: 'text-slate-500' };
    return (
        <div className={`bg-dark-800 border border-dark-700 rounded-xl p-4 ${className}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    {change && (
                        <p className={`text-xs mt-1 ${changeColors[changeType]}`}>{change}</p>
                    )}
                </div>
                {Icon && (
                    <div className={`p-2 rounded-lg bg-dark-900/50 ${iconColor}`}>
                        <Icon size={20} />
                    </div>
                )}
            </div>
        </div>
    );
}
