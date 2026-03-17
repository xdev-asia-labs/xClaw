// ============================================================
// ChannelManagement - Admin channel config (Telegram, Discord, etc.)
// ============================================================

import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import {
    Radio, Play, Square, Plus, Trash2,
    Loader2, RefreshCw, MessageCircle, Bot, Save,
} from 'lucide-react';

interface ChannelConfig {
    id: string;
    platform: string;
    displayName: string;
    isEnabled: boolean;
    config: Record<string, unknown>;
    status: string;
    lastConnectedAt: string | null;
}

const PLATFORM_PRESETS: Record<string, { label: string; icon: React.ReactNode; fields: { key: string; label: string; type: string; placeholder: string }[] }> = {
    telegram: {
        label: 'Telegram Bot',
        icon: <Bot size={18} className="text-blue-400" />,
        fields: [
            { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF...' },
            { key: 'webhookUrl', label: 'Webhook URL (optional)', type: 'text', placeholder: 'https://your-server.com/webhook/telegram' },
        ],
    },
    discord: {
        label: 'Discord Bot',
        icon: <MessageCircle size={18} className="text-indigo-400" />,
        fields: [
            { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'your-discord-bot-token' },
            { key: 'guildId', label: 'Guild ID (optional)', type: 'text', placeholder: '1234567890' },
        ],
    },
};

export function ChannelManagement() {
    const [channels, setChannels] = useState<ChannelConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [editChannel, setEditChannel] = useState<{ platform: string; displayName: string; config: Record<string, string> } | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.admin.getChannels();
            setChannels(res.channels);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const startChannel = async (platform: string) => {
        setActionLoading(platform);
        try {
            await api.admin.startChannel(platform);
            await load();
        } catch { }
        setActionLoading(null);
    };

    const stopChannel = async (platform: string) => {
        setActionLoading(platform);
        try {
            await api.admin.stopChannel(platform);
            await load();
        } catch { }
        setActionLoading(null);
    };

    const deleteChannel = async (id: string) => {
        try {
            await api.admin.deleteChannel(id);
            await load();
        } catch { }
    };

    const saveChannel = async () => {
        if (!editChannel) return;
        setSaveStatus(null);
        setActionLoading('save');
        try {
            await api.admin.saveChannel({
                platform: editChannel.platform,
                displayName: editChannel.displayName,
                config: editChannel.config,
                isEnabled: false,
            });
            setSaveStatus('Saved');
            setEditChannel(null);
            setShowAdd(false);
            await load();
        } catch (err) {
            setSaveStatus(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
        }
        setActionLoading(null);
    };

    const openEdit = (ch: ChannelConfig) => {
        setEditChannel({
            platform: ch.platform,
            displayName: ch.displayName,
            config: ch.config as Record<string, string>,
        });
        setShowAdd(false);
    };

    const openAdd = (platform: string) => {
        const preset = PLATFORM_PRESETS[platform];
        setEditChannel({
            platform,
            displayName: preset?.label || platform,
            config: {},
        });
        setShowAdd(false);
    };

    const availablePlatforms = Object.keys(PLATFORM_PRESETS).filter(p => !channels.some(c => c.platform === p));

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Radio size={24} className="text-slate-400" />
                        <h1 className="text-2xl font-bold text-white">Channels</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {availablePlatforms.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowAdd(!showAdd)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition"
                                >
                                    <Plus size={16} /> Add Channel
                                </button>
                                {showAdd && (
                                    <div className="absolute right-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-xl p-1 z-10">
                                        {availablePlatforms.map(p => (
                                            <button
                                                key={p}
                                                onClick={() => openAdd(p)}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-dark-700 rounded"
                                            >
                                                {PLATFORM_PRESETS[p].icon}
                                                {PLATFORM_PRESETS[p].label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <button onClick={load} className="p-2 hover:bg-dark-800 rounded-lg text-slate-400" title="Refresh">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Edit / Add form */}
                {editChannel && (
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 mb-6">
                        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                            {PLATFORM_PRESETS[editChannel.platform]?.icon}
                            Configure {PLATFORM_PRESETS[editChannel.platform]?.label || editChannel.platform}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
                                <input
                                    type="text"
                                    value={editChannel.displayName}
                                    onChange={e => setEditChannel({ ...editChannel, displayName: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            {(PLATFORM_PRESETS[editChannel.platform]?.fields || []).map(field => (
                                <div key={field.key}>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">{field.label}</label>
                                    <input
                                        type={field.type}
                                        value={(editChannel.config[field.key] as string) || ''}
                                        onChange={e => setEditChannel({
                                            ...editChannel,
                                            config: { ...editChannel.config, [field.key]: e.target.value },
                                        })}
                                        className="input-field"
                                        placeholder={field.placeholder}
                                    />
                                </div>
                            ))}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={saveChannel}
                                    disabled={actionLoading === 'save'}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                                >
                                    {actionLoading === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save
                                </button>
                                <button onClick={() => setEditChannel(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm transition">
                                    Cancel
                                </button>
                                {saveStatus && <span className={`text-xs ${saveStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{saveStatus}</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Channel list */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-slate-500" />
                    </div>
                ) : channels.length === 0 && !editChannel ? (
                    <div className="text-center py-16 text-slate-500">
                        <Radio size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-sm">No channels configured yet</p>
                        <p className="text-xs mt-1">Add a Telegram or Discord bot to get started</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {channels.map(ch => (
                            <div key={ch.id} className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-4">
                                <div className="flex-shrink-0">
                                    {PLATFORM_PRESETS[ch.platform]?.icon || <Radio size={18} className="text-slate-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white">{ch.displayName}</div>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-slate-500">{ch.platform}</span>
                                        <span className={`inline-flex items-center gap-1 text-xs ${ch.status === 'connected' ? 'text-green-400' : ch.status === 'error' ? 'text-red-400' : 'text-slate-500'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${ch.status === 'connected' ? 'bg-green-400' : ch.status === 'error' ? 'bg-red-400' : 'bg-slate-500'
                                                }`} />
                                            {ch.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {actionLoading === ch.platform ? (
                                        <Loader2 size={16} className="animate-spin text-slate-500" />
                                    ) : ch.status === 'connected' ? (
                                        <button
                                            onClick={() => stopChannel(ch.platform)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition"
                                        >
                                            <Square size={12} /> Stop
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => startChannel(ch.platform)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-medium transition"
                                        >
                                            <Play size={12} /> Start
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEdit(ch)}
                                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-dark-700 hover:bg-dark-600 rounded-lg transition"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => deleteChannel(ch.id)}
                                        className="p-1.5 hover:bg-dark-700 rounded text-slate-400 hover:text-red-400 transition"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
