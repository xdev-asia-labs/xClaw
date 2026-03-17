import React from 'react';

// ── Badge ───────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

const badgeStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-600/30 text-slate-300',
    success: 'bg-green-500/15 text-green-400',
    warning: 'bg-amber-500/15 text-amber-400',
    danger: 'bg-red-500/15 text-red-400',
    info: 'bg-blue-500/15 text-blue-400',
    purple: 'bg-purple-500/15 text-purple-400',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badgeStyles[variant]} ${className}`}>
            {children}
        </span>
    );
}

// ── StatusDot ───────────────────────────────────────────────

interface StatusDotProps {
    status: 'healthy' | 'unhealthy' | 'warning' | 'unknown' | 'active' | 'inactive';
    size?: number;
    pulse?: boolean;
}

const dotColors: Record<string, string> = {
    healthy: 'bg-green-400',
    active: 'bg-green-400',
    unhealthy: 'bg-red-400',
    inactive: 'bg-red-400',
    warning: 'bg-amber-400',
    unknown: 'bg-slate-500',
};

export function StatusDot({ status, size = 8, pulse = false }: StatusDotProps) {
    return (
        <span className="relative inline-flex">
            <span
                className={`inline-block rounded-full ${dotColors[status] ?? 'bg-slate-500'}`}
                style={{ width: size, height: size }}
            />
            {pulse && (status === 'healthy' || status === 'active') && (
                <span
                    className={`absolute inset-0 rounded-full ${dotColors[status]} animate-ping opacity-50`}
                    style={{ width: size, height: size }}
                />
            )}
        </span>
    );
}
