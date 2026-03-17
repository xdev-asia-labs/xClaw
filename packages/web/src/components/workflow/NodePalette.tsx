// ============================================================
// Node Palette - Drag nodes from here onto the canvas
// ============================================================

import React, { useState } from 'react';
import { NODE_TYPES, NODE_CATEGORIES, type NodeTypeConfig } from './nodeTypes';
import { Search } from 'lucide-react';

export function NodePalette() {
    const [search, setSearch] = useState('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>('trigger');

    const filtered = search
        ? NODE_TYPES.filter(n =>
            n.label.toLowerCase().includes(search.toLowerCase()) ||
            n.description.toLowerCase().includes(search.toLowerCase())
        )
        : NODE_TYPES;

    const onDragStart = (event: React.DragEvent, nodeConfig: NodeTypeConfig) => {
        event.dataTransfer.setData('application/xclaw-node', JSON.stringify(nodeConfig));
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col h-full">
            <div className="p-3 border-b border-dark-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Node Palette</h3>
                <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search nodes..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-dark-800 border border-dark-700 rounded-md pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {NODE_CATEGORIES.map(cat => {
                    const categoryNodes = filtered.filter(n => n.category === cat.id);
                    if (categoryNodes.length === 0) return null;

                    return (
                        <div key={cat.id}>
                            <button
                                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold ${cat.color} hover:bg-dark-800 rounded`}
                            >
                                <span className={expandedCategory === cat.id ? 'rotate-90' : ''}>▶</span>
                                {cat.label} ({categoryNodes.length})
                            </button>

                            {(expandedCategory === cat.id || search) && (
                                <div className="ml-2 space-y-1 mt-1">
                                    {categoryNodes.map(node => {
                                        const Icon = node.icon;
                                        return (
                                            <div
                                                key={node.type}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, node)}
                                                className={`flex items-center gap-2 px-2 py-2 rounded-md ${node.color} border ${node.borderColor} border-opacity-30 cursor-grab active:cursor-grabbing hover:brightness-125 transition-all`}
                                            >
                                                <Icon size={14} className="text-slate-300 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-white">{node.label}</div>
                                                    <div className="text-[10px] text-slate-400 truncate">{node.description}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
