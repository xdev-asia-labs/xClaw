import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="p-3 rounded-xl bg-dark-800 border border-dark-700 mb-4">
                <Icon size={28} className="text-slate-500" />
            </div>
            <h3 className="text-sm font-medium text-slate-300 mb-1">{title}</h3>
            {description && <p className="text-xs text-slate-500 max-w-xs">{description}</p>}
            {actionLabel && onAction && (
                <Button variant="primary" size="sm" className="mt-4" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
