import React from 'react';
import { RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    onRefresh?: () => void;
    refreshing?: boolean;
    actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, onRefresh, refreshing, actions }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 flex-shrink-0">
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="p-2 rounded-lg bg-dark-800">
                        <Icon size={20} className="text-primary-400" />
                    </div>
                )}
                <div>
                    <h1 className="text-lg font-semibold text-white">{title}</h1>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {actions}
                {onRefresh && (
                    <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRefresh} loading={refreshing}>
                        Refresh
                    </Button>
                )}
            </div>
        </div>
    );
}
