import React from 'react';
import { Loader2 } from 'lucide-react';

// ── Spinner ─────────────────────────────────────────────────

interface SpinnerProps {
    size?: number;
    className?: string;
}

export function Spinner({ size = 20, className = 'text-primary-400' }: SpinnerProps) {
    return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

// ── PageLoader ──────────────────────────────────────────────

export function PageLoader() {
    return (
        <div className="flex-1 flex items-center justify-center">
            <Spinner size={28} />
        </div>
    );
}

// ── Skeleton ────────────────────────────────────────────────

interface SkeletonProps {
    className?: string;
    count?: number;
}

export function Skeleton({ className = 'h-4 w-full', count = 1 }: SkeletonProps) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`bg-dark-700 rounded animate-pulse ${className}`} />
            ))}
        </>
    );
}
