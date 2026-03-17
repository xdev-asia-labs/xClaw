// ============================================================
// Fine-Tuning Studio - Datasets, samples, and training jobs
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { PageHeader, Card, Tabs, Spinner, ErrorBanner, StatCard } from '@/components/ui';
import {
    Sparkles, Plus, Play, Trash2, CheckCircle, XCircle,
    Database, FileText, Cpu, ChevronDown, ChevronUp,
    ChevronLeft, ChevronRight, Wand2,
} from 'lucide-react';

type TabId = 'datasets' | 'samples' | 'jobs';

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-600/20 text-slate-400',
    reviewing: 'bg-yellow-600/20 text-yellow-400',
    approved: 'bg-green-600/20 text-green-400',
    training: 'bg-blue-600/20 text-blue-400',
    completed: 'bg-emerald-600/20 text-emerald-400',
    failed: 'bg-red-600/20 text-red-400',
    pending: 'bg-yellow-600/20 text-yellow-400',
    needs_revision: 'bg-orange-600/20 text-orange-400',
    rejected: 'bg-red-600/20 text-red-400',
    queued: 'bg-slate-600/20 text-slate-400',
    preparing: 'bg-blue-600/20 text-blue-400',
    evaluating: 'bg-purple-600/20 text-purple-400',
};

const PAGE_SIZE = 20;

export function FineTuningStudio() {
    const [tab, setTab] = useState<TabId>('datasets');
    const [datasets, setDatasets] = useState<any[]>([]);
    const [samples, setSamples] = useState<any[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [page, setPage] = useState(0);

    // Create dataset form
    const [showCreateDs, setShowCreateDs] = useState(false);
    const [dsName, setDsName] = useState('');
    const [dsDesc, setDsDesc] = useState('');
    const [dsFormat, setDsFormat] = useState('sharegpt');
    const [dsSource, setDsSource] = useState('manual');
    const [saving, setSaving] = useState(false);

    // Create job form
    const [showCreateJob, setShowCreateJob] = useState(false);
    const [jobDatasetId, setJobDatasetId] = useState('');
    const [jobBaseModel, setJobBaseModel] = useState('');
    const [jobMethod, setJobMethod] = useState('qlora');

    const tabs = [
        { id: 'datasets', label: 'Datasets' },
        { id: 'samples', label: 'Samples' },
        { id: 'jobs', label: 'Jobs' },
    ];

    const loadDatasets = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { datasets: ds } = await api.admin.getDatasets();
            setDatasets(ds);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load datasets');
        } finally { setLoading(false); }
    }, []);

    const loadSamples = useCallback(async () => {
        if (!selectedDataset) { setSamples([]); return; }
        try {
            setLoading(true);
            setError(null);
            const { samples: s } = await api.admin.getSamples(selectedDataset, {
                limit: PAGE_SIZE, offset: page * PAGE_SIZE,
            });
            setSamples(s);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load samples');
        } finally { setLoading(false); }
    }, [selectedDataset, page]);

    const loadJobs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { jobs: j } = await api.admin.getJobs();
            setJobs(j);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load jobs');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (tab === 'datasets') loadDatasets();
        else if (tab === 'samples') loadSamples();
        else if (tab === 'jobs') loadJobs();
    }, [tab, loadDatasets, loadSamples, loadJobs]);

    const handleCreateDataset = async () => {
        try {
            setSaving(true);
            await api.admin.createDataset({ name: dsName, description: dsDesc, format: dsFormat, source: dsSource });
            setShowCreateDs(false);
            setDsName(''); setDsDesc('');
            await loadDatasets();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create dataset');
        } finally { setSaving(false); }
    };

    const handleDeleteDataset = async (id: string) => {
        try {
            await api.admin.deleteDataset(id);
            await loadDatasets();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete dataset');
        }
    };

    const handleSampleStatus = async (id: string, status: string) => {
        try {
            await api.admin.updateSample(id, { status });
            await loadSamples();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update sample');
        }
    };

    const handleGenerateSamples = async (datasetId: string) => {
        try {
            setSaving(true);
            const result = await api.admin.generateSamples(datasetId, { minConfidence: 0.6 });
            setError(null);
            alert(`Generated ${result.generated} samples from learning entries.`);
            if (tab === 'samples' && selectedDataset === datasetId) await loadSamples();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate samples');
        } finally { setSaving(false); }
    };

    const handleCreateJob = async () => {
        try {
            setSaving(true);
            await api.admin.createJob({
                dataset_id: jobDatasetId, base_model: jobBaseModel, method: jobMethod,
                hyperparameters: { epochs: 3, learning_rate: 2e-4, batch_size: 4 },
            });
            setShowCreateJob(false);
            setJobBaseModel('');
            await loadJobs();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create job');
        } finally { setSaving(false); }
    };

    const getDatasetName = (id: string) => datasets.find(d => d.id === id)?.name || id?.slice(0, 8);

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <PageHeader
                icon={Sparkles}
                title="Fine-Tuning Studio"
                subtitle="Manage datasets, training samples, and fine-tuning jobs"
                onRefresh={() => {
                    if (tab === 'datasets') loadDatasets();
                    else if (tab === 'samples') loadSamples();
                    else loadJobs();
                }}
                refreshing={loading}
            />

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="p-4 space-y-4">
                <Tabs tabs={tabs} active={tab} onChange={(id: string) => setTab(id as TabId)} />

                {/* ── Datasets Tab ────────────────────────────── */}
                {tab === 'datasets' && (
                    <>
                        <div className="flex justify-end">
                            <button onClick={() => setShowCreateDs(!showCreateDs)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition">
                                <Plus size={12} /> New Dataset
                            </button>
                        </div>

                        {showCreateDs && (
                            <Card className="p-4 border-blue-600/30">
                                <h3 className="text-sm font-medium text-slate-200 mb-3">Create Dataset</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Name *</label>
                                        <input value={dsName} onChange={e => setDsName(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Format</label>
                                        <select value={dsFormat} onChange={e => setDsFormat(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white">
                                            <option value="sharegpt">ShareGPT</option>
                                            <option value="alpaca">Alpaca</option>
                                            <option value="openai">OpenAI</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs text-slate-400 mb-1 block">Description</label>
                                        <input value={dsDesc} onChange={e => setDsDesc(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3">
                                    <button onClick={() => setShowCreateDs(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">Cancel</button>
                                    <button onClick={handleCreateDataset} disabled={!dsName || saving}
                                        className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50">
                                        {saving ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </Card>
                        )}

                        {loading ? <Spinner /> : datasets.length === 0 ? (
                            <div className="text-center text-sm text-slate-500 py-12">No datasets yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {datasets.map(ds => (
                                    <Card key={ds.id} className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Database size={14} className="text-blue-400" />
                                                    <span className="text-sm font-medium text-white">{ds.name}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[ds.status]}`}>{ds.status}</span>
                                                    <span className="text-[10px] text-slate-500">{ds.format}</span>
                                                </div>
                                                {ds.description && <p className="text-xs text-slate-400 mt-1">{ds.description}</p>}
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    {ds.sample_count} samples · Quality: {(ds.quality_score * 100).toFixed(0)}%
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => { setSelectedDataset(ds.id); setTab('samples'); setPage(0); }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-400 transition" title="View samples">
                                                    <FileText size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleGenerateSamples(ds.id)}
                                                    className="p-1.5 text-slate-400 hover:text-purple-400 transition" title="Auto-generate samples">
                                                    <Wand2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => { setJobDatasetId(ds.id); setShowCreateJob(true); setTab('jobs'); }}
                                                    className="p-1.5 text-slate-400 hover:text-green-400 transition" title="Start training">
                                                    <Play size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDataset(ds.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 transition" title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── Samples Tab ─────────────────────────────── */}
                {tab === 'samples' && (
                    <>
                        <div className="flex items-center gap-3">
                            <select value={selectedDataset || ''} onChange={e => { setSelectedDataset(e.target.value || null); setPage(0); }}
                                className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-white">
                                <option value="">Select dataset</option>
                                {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        {!selectedDataset ? (
                            <div className="text-center text-sm text-slate-500 py-12">Select a dataset to view samples.</div>
                        ) : loading ? <Spinner /> : samples.length === 0 ? (
                            <div className="text-center text-sm text-slate-500 py-12">No samples in this dataset.</div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {samples.map(s => (
                                        <Card key={s.id} className="overflow-hidden">
                                            <div className="p-3 cursor-pointer hover:bg-dark-700/50 transition"
                                                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                                                            {s.quality_rating && (
                                                                <span className="text-[10px] text-yellow-400">{'★'.repeat(s.quality_rating)}{'☆'.repeat(5 - s.quality_rating)}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-300 line-clamp-1"><strong>Input:</strong> {s.input}</p>
                                                        <p className="text-xs text-slate-400 line-clamp-1"><strong>Output:</strong> {s.output}</p>
                                                    </div>
                                                    {expandedId === s.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                                </div>
                                            </div>

                                            {expandedId === s.id && (
                                                <div className="border-t border-dark-600 p-3 bg-dark-800/50 space-y-2">
                                                    {s.instruction && (
                                                        <div>
                                                            <span className="text-xs text-slate-500">Instruction</span>
                                                            <p className="text-xs text-white bg-dark-900 rounded p-2 mt-1 whitespace-pre-wrap">{s.instruction}</p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-xs text-slate-500">Input</span>
                                                        <p className="text-xs text-white bg-dark-900 rounded p-2 mt-1 whitespace-pre-wrap">{s.input}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-slate-500">Output</span>
                                                        <p className="text-xs text-white bg-dark-900 rounded p-2 mt-1 whitespace-pre-wrap">{s.output}</p>
                                                    </div>
                                                    <div className="flex gap-2 mt-2">
                                                        {s.status !== 'approved' && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleSampleStatus(s.id, 'approved'); }}
                                                                className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition">
                                                                <CheckCircle size={12} /> Approve
                                                            </button>
                                                        )}
                                                        {s.status !== 'rejected' && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleSampleStatus(s.id, 'rejected'); }}
                                                                className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition">
                                                                <XCircle size={12} /> Reject
                                                            </button>
                                                        )}
                                                        {s.status !== 'needs_revision' && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleSampleStatus(s.id, 'needs_revision'); }}
                                                                className="flex items-center gap-1 px-3 py-1 text-xs bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded transition">
                                                                Needs Revision
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </Card>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition">
                                        <ChevronLeft size={14} /> Previous
                                    </button>
                                    <span className="text-xs text-slate-500">Page {page + 1}</span>
                                    <button disabled={samples.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition">
                                        Next <ChevronRight size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* ── Jobs Tab ────────────────────────────────── */}
                {tab === 'jobs' && (
                    <>
                        <div className="flex justify-end">
                            <button onClick={() => setShowCreateJob(!showCreateJob)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition">
                                <Play size={12} /> New Job
                            </button>
                        </div>

                        {showCreateJob && (
                            <Card className="p-4 border-green-600/30">
                                <h3 className="text-sm font-medium text-slate-200 mb-3">Create Training Job</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Dataset *</label>
                                        <select value={jobDatasetId} onChange={e => setJobDatasetId(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white">
                                            <option value="">Select dataset</option>
                                            {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Base Model *</label>
                                        <input value={jobBaseModel} onChange={e => setJobBaseModel(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white"
                                            placeholder="e.g. llama3.1:8b" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Method</label>
                                        <select value={jobMethod} onChange={e => setJobMethod(e.target.value)}
                                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-1.5 text-sm text-white">
                                            <option value="qlora">QLoRA</option>
                                            <option value="lora">LoRA</option>
                                            <option value="full">Full Fine-tune</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3">
                                    <button onClick={() => setShowCreateJob(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">Cancel</button>
                                    <button onClick={handleCreateJob} disabled={!jobDatasetId || !jobBaseModel || saving}
                                        className="px-4 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50">
                                        {saving ? 'Creating...' : 'Start Training'}
                                    </button>
                                </div>
                            </Card>
                        )}

                        {loading ? <Spinner /> : jobs.length === 0 ? (
                            <div className="text-center text-sm text-slate-500 py-12">No training jobs yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {jobs.map(j => (
                                    <Card key={j.id} className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Cpu size={14} className="text-green-400" />
                                                    <span className="text-sm font-medium text-white">{j.base_model}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[j.status]}`}>{j.status}</span>
                                                    <span className="text-[10px] text-slate-500 uppercase">{j.method}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    Dataset: {getDatasetName(j.dataset_id)} · Progress: {j.progress}%
                                                    {j.output_model && <span> · Output: {j.output_model}</span>}
                                                </div>
                                                {j.error_message && (
                                                    <p className="text-[10px] text-red-400 mt-1">{j.error_message}</p>
                                                )}
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        {['training', 'evaluating', 'preparing'].includes(j.status) && (
                                            <div className="mt-2 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${j.progress}%` }} />
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
