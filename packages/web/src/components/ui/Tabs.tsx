import React from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;
}

interface TabsProps {
    tabs: Tab[];
    active: string;
    onChange: (id: string) => void;
    className?: string;
}

export function Tabs({ tabs, active, onChange, className = '' }: TabsProps) {
    return (
        <div className={`flex gap-1 rounded-lg bg-dark-800 p-1 ${className}`}>
            {tabs.map(tab => {
                const isActive = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive
                                ? 'bg-primary-600/20 text-primary-400'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.count != null && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isActive ? 'bg-primary-600/30 text-primary-300' : 'bg-dark-700 text-slate-500'
                                }`}>{tab.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
