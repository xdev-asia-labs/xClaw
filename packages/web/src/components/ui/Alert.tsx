import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

// ── ErrorBanner ─────────────────────────────────────────────

interface ErrorBannerProps {
    message: string;
    onDismiss?: () => void;
    className?: string;
}

export function ErrorBanner({ message, onDismiss, className = '' }: ErrorBannerProps) {
    return (
        <div className={`flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg ${className}`}>
            <AlertCircle size={14} className="flex-shrink-0" />
            <span className="flex-1">{message}</span>
            {onDismiss && (
                <button onClick={onDismiss} className="p-0.5 hover:bg-red-500/20 rounded transition">
                    <X size={12} />
                </button>
            )}
        </div>
    );
}

// ── Alert ───────────────────────────────────────────────────

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
    variant?: AlertVariant;
    children: React.ReactNode;
    className?: string;
}

const alertConfig: Record<AlertVariant, { icon: typeof Info; bg: string; border: string; text: string }> = {
    info: { icon: Info, bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
    success: { icon: CheckCircle, bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
    error: { icon: AlertCircle, bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
};

export function Alert({ variant = 'info', children, className = '' }: AlertProps) {
    const cfg = alertConfig[variant];
    const Icon = cfg.icon;
    return (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border text-sm ${cfg.bg} ${cfg.border} ${cfg.text} ${className}`}>
            <Icon size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{children}</div>
        </div>
    );
}
