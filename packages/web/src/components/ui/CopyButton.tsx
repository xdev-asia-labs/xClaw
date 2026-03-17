import React, { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
    text: string;
    className?: string;
    size?: number;
}

export function CopyButton({ text, className = '', size = 14 }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked */ }
    }, [text]);

    return (
        <button
            onClick={copy}
            className={`p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-dark-700 transition ${copied ? '!text-emerald-400' : ''} ${className}`}
            title={copied ? 'Copied!' : 'Copy'}
        >
            {copied ? <Check size={size} /> : <Copy size={size} />}
        </button>
    );
}
