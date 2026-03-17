import React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon?: LucideIcon;
    iconRight?: LucideIcon;
    loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-600/20',
    secondary: 'bg-dark-800 hover:bg-dark-700 text-slate-200 border border-dark-600',
    danger: 'bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20',
    ghost: 'hover:bg-dark-800 text-slate-400 hover:text-white',
};

const sizeStyles: Record<Size, string> = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2.5',
};

export function Button({
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading,
    disabled,
    children,
    className = '',
    ...rest
}: ButtonProps) {
    const iconSize = size === 'sm' ? 14 : 16;
    return (
        <button
            disabled={disabled || loading}
            className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...rest}
        >
            {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon && <Icon size={iconSize} />}
            {children}
            {IconRight && !loading && <IconRight size={iconSize} />}
        </button>
    );
}
