import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────

export interface Column<T> {
    key: string;
    header: string;
    sortable?: boolean;
    className?: string;
    render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyField: string;
    pageSize?: number;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    className?: string;
}

// ── DataTable ───────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
    columns, data, keyField, pageSize = 10, emptyMessage = 'No data', onRowClick, className = '',
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(0);

    const sorted = useMemo(() => {
        if (!sortKey) return data;
        return [...data].sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            if (av == null || bv == null) return 0;
            const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [data, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const rows = sorted.slice(page * pageSize, (page + 1) * pageSize);

    function toggleSort(key: string) {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    }

    const SortIcon = ({ col }: { col: string }) => {
        if (sortKey !== col) return <ChevronUp size={12} className="text-slate-700" />;
        return sortDir === 'asc' ? <ChevronUp size={12} className="text-primary-400" /> : <ChevronDown size={12} className="text-primary-400" />;
    };

    return (
        <div className={`rounded-lg border border-dark-700 overflow-hidden ${className}`}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-dark-800 border-b border-dark-700">
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={`px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider ${col.sortable ? 'cursor-pointer select-none hover:text-slate-200' : ''} ${col.className ?? ''}`}
                                    onClick={() => col.sortable && toggleSort(col.key)}
                                >
                                    <span className="flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && <SortIcon col={col.key} />}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700/50">
                        {rows.length === 0 ? (
                            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">{emptyMessage}</td></tr>
                        ) : rows.map(row => (
                            <tr
                                key={String(row[keyField])}
                                className={`bg-dark-850 hover:bg-dark-800 transition ${onRowClick ? 'cursor-pointer' : ''}`}
                                onClick={() => onRowClick?.(row)}
                            >
                                {columns.map(col => (
                                    <td key={col.key} className={`px-4 py-3 text-slate-300 ${col.className ?? ''}`}>
                                        {col.render ? col.render(row) : String(row[col.key] ?? '')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-dark-700 bg-dark-800 text-xs text-slate-400">
                    <span>{sorted.length} row{sorted.length !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-dark-700 disabled:opacity-30"><ChevronLeft size={14} /></button>
                        <span>{page + 1} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-dark-700 disabled:opacity-30"><ChevronRight size={14} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
