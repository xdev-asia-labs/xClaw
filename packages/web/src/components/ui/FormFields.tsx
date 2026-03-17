import React from 'react';
import { Search } from 'lucide-react';

// ── Input ───────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className = '', id, ...rest }: InputProps) {
    const fieldId = id ?? label?.toLowerCase().replace(/\s/g, '-');
    return (
        <div className="space-y-1.5">
            {label && <label htmlFor={fieldId} className="block text-xs font-medium text-slate-400">{label}</label>}
            <input
                id={fieldId}
                className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 focus:outline-none transition ${error ? 'border-red-500' : 'border-dark-600'} ${className}`}
                {...rest}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}

// ── Textarea ────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export function Textarea({ label, error, className = '', id, ...rest }: TextareaProps) {
    const fieldId = id ?? label?.toLowerCase().replace(/\s/g, '-');
    return (
        <div className="space-y-1.5">
            {label && <label htmlFor={fieldId} className="block text-xs font-medium text-slate-400">{label}</label>}
            <textarea
                id={fieldId}
                className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 focus:outline-none transition resize-none ${error ? 'border-red-500' : 'border-dark-600'} ${className}`}
                {...rest}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}

// ── Select ──────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', id, ...rest }: SelectProps) {
    const fieldId = id ?? label?.toLowerCase().replace(/\s/g, '-');
    return (
        <div className="space-y-1.5">
            {label && <label htmlFor={fieldId} className="block text-xs font-medium text-slate-400">{label}</label>}
            <select
                id={fieldId}
                className={`w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 focus:outline-none transition ${className}`}
                {...rest}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// ── SearchInput ─────────────────────────────────────────────

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    onSearch?: (value: string) => void;
}

export function SearchInput({ className = '', onSearch, onChange, ...rest }: SearchInputProps) {
    return (
        <div className={`relative ${className}`}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
                type="text"
                className="w-full bg-dark-900 border border-dark-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 focus:outline-none transition"
                onChange={(e) => { onChange?.(e); onSearch?.(e.target.value); }}
                {...rest}
            />
        </div>
    );
}
