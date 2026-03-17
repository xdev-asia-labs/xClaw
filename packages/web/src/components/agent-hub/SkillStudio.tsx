// ============================================================
// Skill Studio - Admin config page for individual agents/skills
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft, Save, RotateCcw, Settings, Wrench, BarChart3,
    AlertTriangle, Eye, EyeOff, Check, X, Power, PowerOff,
    Shield, Clock, Activity, Trash2,
} from 'lucide-react';

interface SkillConfigField {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'secret';
    description: string;
    required?: boolean;
    default?: unknown;
    options?: { label: string; value: string }[];
}

interface ToolDef {
    name: string;
    description: string;
    category: string;
    requiresApproval?: boolean;
}

interface AgentData {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    category: string;
    tags: string[];
    icon: string;
    iconColor: string;
    iconBg: string;
    tools: ToolDef[];
    config?: SkillConfigField[];
    isBuiltIn?: boolean;
    status: 'active' | 'installed' | 'available';
}

interface SkillStudioProps {
    agent: AgentData;
    onBack: () => void;
}

export function SkillStudio({ agent, onBack }: SkillStudioProps) {
    const [activeTab, setActiveTab] = useState<'config' | 'tools' | 'stats'>('config');
    const [configValues, setConfigValues] = useState<Record<string, unknown>>({});
    const [toolStates, setToolStates] = useState<Record<string, boolean>>({});
    const [secrets, setSecrets] = useState<Record<string, boolean>>({}); // show/hide secrets
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize config with defaults
    useEffect(() => {
        const defaults: Record<string, unknown> = {};
        for (const field of agent.config ?? []) {
            defaults[field.key] = field.default ?? '';
        }
        setConfigValues(defaults);

        // All tools enabled by default
        const tools: Record<string, boolean> = {};
        for (const tool of agent.tools) {
            tools[tool.name] = true;
        }
        setToolStates(tools);
    }, [agent]);

    const enabledToolCount = useMemo(
        () => Object.values(toolStates).filter(Boolean).length,
        [toolStates],
    );

    const handleConfigChange = (key: string, value: unknown) => {
        setConfigValues(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
        setSaved(false);
    };

    const handleToolToggle = (toolName: string) => {
        setToolStates(prev => ({ ...prev, [toolName]: !prev[toolName] }));
        setHasChanges(true);
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // API calls for save
            await new Promise(r => setTimeout(r, 600));
            setSaved(true);
            setHasChanges(false);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        const defaults: Record<string, unknown> = {};
        for (const field of agent.config ?? []) {
            defaults[field.key] = field.default ?? '';
        }
        setConfigValues(defaults);
        const tools: Record<string, boolean> = {};
        for (const tool of agent.tools) {
            tools[tool.name] = true;
        }
        setToolStates(tools);
        setHasChanges(false);
        setSaved(false);
    };

    const TABS = [
        { id: 'config' as const, label: 'Configuration', icon: Settings },
        { id: 'tools' as const, label: `Tools (${enabledToolCount}/${agent.tools.length})`, icon: Wrench },
        { id: 'stats' as const, label: 'Statistics', icon: BarChart3 },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-dark-700">
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${agent.iconBg}`}>
                            {agent.icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-white">{agent.name}</h2>
                                <span className="px-2 py-0.5 text-xs rounded-full bg-dark-700 text-slate-400">
                                    v{agent.version}
                                </span>
                                {agent.status === 'active' && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                                        <Power size={10} /> Active
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-400">{agent.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasChanges && (
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-dark-700 transition"
                            >
                                <RotateCcw size={14} /> Reset
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                saved
                                    ? 'bg-emerald-600/20 text-emerald-400'
                                    : hasChanges
                                    ? 'bg-primary-600 text-white hover:bg-primary-500'
                                    : 'bg-dark-700 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            {saving ? (
                                <span className="animate-spin">⏳</span>
                            ) : saved ? (
                                <Check size={14} />
                            ) : (
                                <Save size={14} />
                            )}
                            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                                activeTab === tab.id
                                    ? 'bg-primary-600/20 text-primary-400'
                                    : 'text-slate-400 hover:text-white hover:bg-dark-800'
                            }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
                {activeTab === 'config' && (
                    <ConfigPanel
                        fields={agent.config ?? []}
                        values={configValues}
                        secrets={secrets}
                        onChange={handleConfigChange}
                        onToggleSecret={(key) => setSecrets(prev => ({ ...prev, [key]: !prev[key] }))}
                    />
                )}
                {activeTab === 'tools' && (
                    <ToolsPanel
                        tools={agent.tools}
                        states={toolStates}
                        onToggle={handleToolToggle}
                    />
                )}
                {activeTab === 'stats' && (
                    <StatsPanel agent={agent} enabledTools={enabledToolCount} />
                )}
            </div>
        </div>
    );
}

// ─── Config Panel ────────────────────────────────────────────

function ConfigPanel({
    fields,
    values,
    secrets,
    onChange,
    onToggleSecret,
}: {
    fields: SkillConfigField[];
    values: Record<string, unknown>;
    secrets: Record<string, boolean>;
    onChange: (key: string, value: unknown) => void;
    onToggleSecret: (key: string) => void;
}) {
    if (fields.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Settings size={48} className="mb-4 opacity-30" />
                <p className="text-lg font-medium">No configuration needed</p>
                <p className="text-sm">This agent works out of the box with default settings</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
                <Settings size={18} className="text-primary-400" />
                <h3 className="text-lg font-semibold text-white">Configuration</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
                Configure this agent's settings. Changes will be applied after saving.
            </p>

            {fields.map(field => (
                <div key={field.key} className="bg-dark-800 rounded-xl p-4 border border-dark-700">
                    <label className="flex items-center gap-2 text-sm font-medium text-white mb-1">
                        {field.label}
                        {field.required && <span className="text-red-400 text-xs">required</span>}
                    </label>
                    <p className="text-xs text-slate-500 mb-3">{field.description}</p>

                    {field.type === 'string' && (
                        <input
                            type="text"
                            value={(values[field.key] as string) ?? ''}
                            onChange={e => onChange(field.key, e.target.value)}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm outline-none focus:border-primary-500 transition"
                        />
                    )}

                    {field.type === 'number' && (
                        <input
                            type="number"
                            value={(values[field.key] as number) ?? 0}
                            onChange={e => onChange(field.key, Number(e.target.value))}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm outline-none focus:border-primary-500 transition"
                        />
                    )}

                    {field.type === 'boolean' && (
                        <button
                            onClick={() => onChange(field.key, !values[field.key])}
                            className={`relative w-11 h-6 rounded-full transition ${
                                values[field.key] ? 'bg-primary-600' : 'bg-dark-600'
                            }`}
                        >
                            <div
                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                    values[field.key] ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                            />
                        </button>
                    )}

                    {field.type === 'select' && (
                        <select
                            value={(values[field.key] as string) ?? ''}
                            onChange={e => onChange(field.key, e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm outline-none focus:border-primary-500 cursor-pointer"
                        >
                            {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    )}

                    {field.type === 'secret' && (
                        <div className="relative">
                            <input
                                type={secrets[field.key] ? 'text' : 'password'}
                                value={(values[field.key] as string) ?? ''}
                                onChange={e => onChange(field.key, e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-3 py-2 pr-10 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm outline-none focus:border-primary-500 transition font-mono"
                            />
                            <button
                                onClick={() => onToggleSecret(field.key)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
                            >
                                {secrets[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Tools Panel ─────────────────────────────────────────────

function ToolsPanel({
    tools,
    states,
    onToggle,
}: {
    tools: ToolDef[];
    states: Record<string, boolean>;
    onToggle: (name: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Wrench size={18} className="text-primary-400" />
                    <h3 className="text-lg font-semibold text-white">Tools</h3>
                </div>
                <span className="text-sm text-slate-400">
                    {Object.values(states).filter(Boolean).length} / {tools.length} enabled
                </span>
            </div>
            <p className="text-sm text-slate-400 mb-4">
                Toggle individual tools on or off. Disabled tools will not be available to the AI agent.
            </p>

            <div className="space-y-2">
                {tools.map(tool => {
                    const enabled = states[tool.name] ?? true;
                    return (
                        <div
                            key={tool.name}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition ${
                                enabled
                                    ? 'bg-dark-800 border-dark-700'
                                    : 'bg-dark-900/50 border-dark-800 opacity-60'
                            }`}
                        >
                            <button
                                onClick={() => onToggle(tool.name)}
                                className={`relative w-11 h-6 rounded-full flex-shrink-0 transition ${
                                    enabled ? 'bg-primary-600' : 'bg-dark-600'
                                }`}
                            >
                                <div
                                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                        enabled ? 'translate-x-5' : 'translate-x-0.5'
                                    }`}
                                />
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono text-white">{tool.name}</code>
                                    {tool.requiresApproval && (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-400">
                                            <Shield size={10} /> Approval
                                        </span>
                                    )}
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-dark-700 text-slate-500">
                                        {tool.category}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{tool.description}</p>
                            </div>
                            {enabled ? (
                                <Power size={16} className="text-emerald-400 flex-shrink-0" />
                            ) : (
                                <PowerOff size={16} className="text-slate-600 flex-shrink-0" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Stats Panel ─────────────────────────────────────────────

function StatsPanel({ agent, enabledTools }: { agent: AgentData; enabledTools: number }) {
    const stats = [
        { label: 'Total Tools', value: agent.tools.length, icon: Wrench, color: 'text-blue-400' },
        { label: 'Enabled Tools', value: enabledTools, icon: Power, color: 'text-emerald-400' },
        { label: 'Invocations', value: '—', icon: Activity, color: 'text-purple-400' },
        { label: 'Last Used', value: '—', icon: Clock, color: 'text-amber-400' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={18} className="text-primary-400" />
                <h3 className="text-lg font-semibold text-white">Usage Statistics</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {stats.map(s => (
                    <div key={s.label} className="bg-dark-800 rounded-xl p-5 border border-dark-700">
                        <div className="flex items-center gap-2 mb-2">
                            <s.icon size={16} className={s.color} />
                            <span className="text-sm text-slate-400">{s.label}</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Agent Info */}
            <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
                <h4 className="text-sm font-medium text-white mb-3">Agent Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-slate-500">Author</span>
                        <p className="text-white">{agent.author}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Version</span>
                        <p className="text-white">{agent.version}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Category</span>
                        <p className="text-white capitalize">{agent.category}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Source</span>
                        <p className="text-white">{agent.isBuiltIn ? 'Built-in' : 'Store'}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {agent.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-dark-700 text-slate-400">
                            {t}
                        </span>
                    ))}
                </div>
            </div>

            {/* Danger Zone */}
            {!agent.isBuiltIn && (
                <div className="bg-red-950/30 rounded-xl p-5 border border-red-900/30">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-red-400" />
                        <h4 className="text-sm font-medium text-red-400">Danger Zone</h4>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white">Uninstall Agent</p>
                            <p className="text-xs text-slate-500">Remove this agent and all its configuration</p>
                        </div>
                        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 transition">
                            <Trash2 size={14} /> Uninstall
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
