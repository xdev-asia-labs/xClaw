import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface Toast {
    id: number;
    message: string;
    variant: ToastVariant;
}

interface ToastCtx {
    toast: (message: string, variant?: ToastVariant) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
}

// ── Context ─────────────────────────────────────────────────

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
    return ctx;
}

// ── Config ──────────────────────────────────────────────────

const ICONS: Record<ToastVariant, React.ReactNode> = {
    info: <Info size={16} className="text-blue-400 shrink-0" />,
    success: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
    error: <XCircle size={16} className="text-red-400 shrink-0" />,
};

const BG: Record<ToastVariant, string> = {
    info: 'border-blue-500/20 bg-blue-950/60',
    success: 'border-emerald-500/20 bg-emerald-950/60',
    warning: 'border-amber-500/20 bg-amber-950/60',
    error: 'border-red-500/20 bg-red-950/60',
};

const DURATION = 4000;

// ── Provider ────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counter = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts(ts => ts.filter(t => t.id !== id));
    }, []);

    const push = useCallback((message: string, variant: ToastVariant = 'info') => {
        const id = ++counter.current;
        setToasts(ts => [...ts, { id, message, variant }]);
        setTimeout(() => dismiss(id), DURATION);
    }, [dismiss]);

    const ctx: ToastCtx = {
        toast: push,
        success: (m) => push(m, 'success'),
        error: (m) => push(m, 'error'),
        warning: (m) => push(m, 'warning'),
        info: (m) => push(m, 'info'),
    };

    return (
        <Ctx.Provider value={ctx}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-xl backdrop-blur text-sm text-slate-200 animate-slide-up ${BG[t.variant]}`}
                    >
                        {ICONS[t.variant]}
                        <span className="flex-1">{t.message}</span>
                        <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-300 transition shrink-0">
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}
