import React from 'react';

const COLORS = [
    'bg-primary-600', 'bg-emerald-600', 'bg-amber-600', 'bg-violet-600',
    'bg-rose-600', 'bg-cyan-600', 'bg-orange-600', 'bg-indigo-600',
];

function pickColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return COLORS[Math.abs(h) % COLORS.length];
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

interface AvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE = { sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-12 h-12 text-sm' };

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
    return (
        <div className={`${SIZE[size]} ${pickColor(name)} rounded-full flex items-center justify-center font-semibold text-white shrink-0 ${className}`}>
            {initials(name)}
        </div>
    );
}
