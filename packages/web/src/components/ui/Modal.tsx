import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

// ── Modal ───────────────────────────────────────────────────

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className={`w-full ${sizeMap[size]} bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-dark-700">
                    <div>
                        <h3 className="text-base font-semibold text-white">{title}</h3>
                        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-dark-700 transition">
                        <X size={16} />
                    </button>
                </div>
                {/* Body */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">{children}</div>
                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-dark-700">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── ConfirmDialog ───────────────────────────────────────────

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', variant = 'danger', loading }: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} size="sm" footer={
            <>
                <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
            </>
        }>
            <p className="text-sm text-slate-400">{description}</p>
        </Modal>
    );
}
