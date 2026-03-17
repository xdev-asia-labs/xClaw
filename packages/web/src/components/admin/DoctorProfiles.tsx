// ============================================================
// Doctor Profiles - Admin management of doctor profiles
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, Spinner, ErrorBanner } from '@/components/ui';
import {
    UserCog, Plus, Search, Brain, BookOpen,
    Activity, CheckCircle, XCircle, Edit2, ChevronDown, ChevronUp,
} from 'lucide-react';

const RESPONSE_STYLES = ['concise', 'detailed', 'academic'] as const;

export function DoctorProfiles() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);

    // Create form fields
    const [formUserId, setFormUserId] = useState('');
    const [formSpecialty, setFormSpecialty] = useState('');
    const [formHospital, setFormHospital] = useState('');
    const [formYears, setFormYears] = useState('');
    const [formStyle, setFormStyle] = useState<string>('detailed');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { profiles: p } = await api.admin.getDoctors();
            setProfiles(p);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load doctor profiles');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        try {
            setSaving(true);
            await api.admin.createDoctor({
                user_id: formUserId,
                specialty: formSpecialty.split(',').map(s => s.trim()).filter(Boolean),
                hospital: formHospital || undefined,
                experience_years: formYears ? parseInt(formYears) : undefined,
                response_style: formStyle,
            });
            setShowCreate(false);
            setFormUserId(''); setFormSpecialty(''); setFormHospital(''); setFormYears('');
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create profile');
        } finally {
            setSaving(false);
        }
    };

    const toggleAutoLearn = async (profile: any) => {
        try {
            await api.admin.updateDoctor(profile.id, { auto_learn: !profile.auto_learn });
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
        }
    };

    const filtered = profiles.filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (p.hospital || '').toLowerCase().includes(q) ||
            (p.specialty || []).some((s: string) => s.toLowerCase().includes(q)) ||
            (p.user_id || '').toLowerCase().includes(q);
    });

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <PageHeader
                icon={UserCog}
                title="Doctor Profiles"
                subtitle={`${profiles.length} profiles configured`}
                onRefresh={load}
                refreshing={loading}
                actions={
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                    >
                        <Plus size={12} /> New Profile
                    </button>
                }
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="p-4 space-y-4">
                {/* Create form */}
                {showCreate && (
                    <Card className="p-4 border-blue-600/30">
                        <h3 className="text-sm font-medium text-slate-200 mb-3">Create Doctor Profile</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">User ID *</label>
                                <input
                                    value={formUserId} onChange={e => setFormUserId(e.target.value)}
                                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white"
                                    placeholder="UUID of existing user"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Specialty (comma-separated)</label>
                                <input
                                    value={formSpecialty} onChange={e => setFormSpecialty(e.target.value)}
                                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white"
                                    placeholder="e.g. Cardiology, Internal Medicine"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Hospital</label>
                                <input
                                    value={formHospital} onChange={e => setFormHospital(e.target.value)}
                                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white"
                                    placeholder="Hospital name"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Experience (years)</label>
                                <input
                                    type="number" value={formYears} onChange={e => setFormYears(e.target.value)}
                                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white"
                                    placeholder="e.g. 10"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Response Style</label>
                                <select
                                    value={formStyle} onChange={e => setFormStyle(e.target.value)}
                                    className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white"
                                >
                                    {RESPONSE_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">Cancel</button>
                            <button onClick={handleCreate} disabled={!formUserId || saving}
                                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50">
                                {saving ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </Card>
                )}

                {/* Search */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full bg-dark-800 border border-dark-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500"
                        placeholder="Search by specialty, hospital..."
                    />
                </div>

                {/* List */}
                {loading ? <Spinner /> : filtered.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 py-12">
                        No doctor profiles found.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(p => (
                            <Card key={p.id} className="overflow-hidden">
                                <div
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-dark-700/50 transition"
                                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                                            <UserCog size={16} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">
                                                {p.hospital || 'No hospital'}{' '}
                                                <span className="text-slate-500 text-xs">· {p.user_id?.slice(0, 8)}</span>
                                            </div>
                                            <div className="flex gap-1.5 mt-0.5">
                                                {(p.specialty || []).map((s: string, i: number) => (
                                                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-600/20 text-blue-300 rounded">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs px-2 py-0.5 rounded ${p.auto_learn ? 'bg-green-600/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                            {p.auto_learn ? 'Auto-learn ON' : 'Auto-learn OFF'}
                                        </span>
                                        {expandedId === p.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                    </div>
                                </div>

                                {expandedId === p.id && (
                                    <div className="border-t border-dark-600 p-4 bg-dark-800/50">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                            <div>
                                                <span className="text-slate-500">Experience</span>
                                                <p className="text-white">{p.experience_years ?? '–'} years</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Response Style</span>
                                                <p className="text-white capitalize">{p.response_style}</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Language</span>
                                                <p className="text-white uppercase">{p.preferred_language}</p>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Preferred Model</span>
                                                <p className="text-white">{p.preferred_model_id || 'Default'}</p>
                                            </div>
                                        </div>
                                        {p.custom_instructions && (
                                            <div className="mt-3">
                                                <span className="text-xs text-slate-500">Custom Instructions</span>
                                                <p className="text-xs text-slate-300 mt-1 bg-dark-900 rounded p-2">{p.custom_instructions}</p>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-3">
                                            <button onClick={() => toggleAutoLearn(p)}
                                                className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition ${p.auto_learn ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}>
                                                {p.auto_learn ? <><XCircle size={12} /> Disable Auto-learn</> : <><CheckCircle size={12} /> Enable Auto-learn</>}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
