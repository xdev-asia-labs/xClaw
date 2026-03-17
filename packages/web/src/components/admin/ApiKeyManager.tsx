// ============================================================
// ApiKeyManager - User API key management + embed widget snippet
// ============================================================

import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { Key, Plus, Trash2, Copy, Check, Loader2, Code } from 'lucide-react';

interface ApiKeyRow {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
    lastUsedAt: string | null;
    createdAt: string;
}

export function ApiKeyManager() {
    const [keys, setKeys] = useState<ApiKeyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showEmbed, setShowEmbed] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.getApiKeys();
            setKeys(res.keys);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const createKey = async () => {
        if (!newKeyName.trim()) return;
        setCreating(true);
        try {
            const res = await api.createApiKey(newKeyName.trim());
            setRevealedKey(res.key);
            setNewKeyName('');
            await load();
        } catch { }
        setCreating(false);
    };

    const deleteKey = async (id: string) => {
        try {
            await api.deleteApiKey(id);
            setKeys(prev => prev.filter(k => k.id !== id));
        } catch { }
    };

    const copyKey = () => {
        if (revealedKey) {
            navigator.clipboard.writeText(revealedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const embedSnippet = `<!-- xClaw Chat Widget -->
<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${window.location.origin}/embed/xclaw-widget.js';
    s.dataset.apiKey = 'YOUR_API_KEY_HERE';
    s.dataset.theme = 'dark';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 mb-6">
                    <Key size={24} className="text-slate-400" />
                    <h1 className="text-2xl font-bold text-white">API Keys</h1>
                </div>

                {/* Create new key */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 mb-6">
                    <h2 className="text-sm font-semibold text-slate-300 mb-3">Create New API Key</h2>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newKeyName}
                            onChange={e => setNewKeyName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createKey()}
                            className="input-field flex-1"
                            placeholder="Key name (e.g. Production Widget)"
                        />
                        <button
                            onClick={createKey}
                            disabled={creating || !newKeyName.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                        >
                            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Create
                        </button>
                    </div>
                </div>

                {/* Revealed key (shown once) */}
                {revealedKey && (
                    <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 mb-6">
                        <div className="text-xs text-amber-400 font-medium mb-2">
                            Save this key now — it won't be shown again
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm text-amber-200 bg-dark-900/50 px-3 py-2 rounded font-mono break-all">
                                {revealedKey}
                            </code>
                            <button onClick={copyKey} className="p-2 hover:bg-dark-700 rounded text-amber-400 transition">
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Key list */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 size={24} className="animate-spin text-slate-500" />
                    </div>
                ) : keys.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        No API keys yet. Create one to use the embeddable chat widget.
                    </div>
                ) : (
                    <div className="space-y-2 mb-6">
                        {keys.map(key => (
                            <div key={key.id} className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3 flex items-center gap-4">
                                <Key size={14} className="text-slate-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white font-medium">{key.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        axk_{key.prefix}... &middot; Created {new Date(key.createdAt).toLocaleDateString()}
                                        {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteKey(key.id)}
                                    className="p-1.5 hover:bg-dark-700 rounded text-slate-400 hover:text-red-400 transition"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Embed snippet */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                    <button
                        onClick={() => setShowEmbed(!showEmbed)}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition"
                    >
                        <Code size={16} />
                        Embed Chat Widget in Your Website
                    </button>
                    {showEmbed && (
                        <div className="mt-4">
                            <p className="text-xs text-slate-400 mb-3">
                                Add this snippet to your website HTML. Replace YOUR_API_KEY_HERE with an actual API key.
                            </p>
                            <pre className="bg-dark-900 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre">
                                {embedSnippet}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
