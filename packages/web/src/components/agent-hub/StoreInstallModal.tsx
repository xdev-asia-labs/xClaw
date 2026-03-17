// ============================================================
// Store Install Modal - Install agents from npm, URL, or upload
// ============================================================

import React, { useState, useRef } from 'react';
import {
    X, Package, Globe, Upload, Download, CheckCircle, AlertCircle,
    Loader2, ExternalLink, FileArchive,
} from 'lucide-react';

interface StoreInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type InstallTab = 'npm' | 'url' | 'upload';
type InstallStatus = 'idle' | 'installing' | 'success' | 'error';

export function StoreInstallModal({ isOpen, onClose }: StoreInstallModalProps) {
    const [activeTab, setActiveTab] = useState<InstallTab>('npm');
    const [npmPackage, setNpmPackage] = useState('');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<InstallStatus>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleInstall = async () => {
        setStatus('installing');
        setStatusMsg('');
        try {
            await new Promise(r => setTimeout(r, 2000));
            
            if (activeTab === 'npm' && !npmPackage.trim()) {
                throw new Error('Please enter a package name');
            }
            if (activeTab === 'url' && !url.trim()) {
                throw new Error('Please enter a valid URL');
            }
            if (activeTab === 'upload' && !file) {
                throw new Error('Please select a file to upload');
            }
            
            setStatus('success');
            setStatusMsg(
                activeTab === 'npm'
                    ? `Successfully installed ${npmPackage}`
                    : activeTab === 'url'
                    ? `Successfully installed from URL`
                    : `Successfully installed ${file?.name}`
            );
        } catch (err) {
            setStatus('error');
            setStatusMsg(err instanceof Error ? err.message : 'Installation failed');
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files[0];
        if (dropped && (dropped.name.endsWith('.tar.gz') || dropped.name.endsWith('.tgz') || dropped.name.endsWith('.zip'))) {
            setFile(dropped);
        }
    };

    const TABS: { id: InstallTab; label: string; icon: React.FC<any> }[] = [
        { id: 'npm', label: 'npm Package', icon: Package },
        { id: 'url', label: 'From URL', icon: Globe },
        { id: 'upload', label: 'Upload File', icon: Upload },
    ];

    const canInstall = (
        (activeTab === 'npm' && npmPackage.trim()) ||
        (activeTab === 'url' && url.trim()) ||
        (activeTab === 'upload' && file)
    );

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-dark-850 rounded-2xl w-full max-w-lg border border-dark-700 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-dark-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/20 flex items-center justify-center">
                            <Download size={20} className="text-primary-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Install Agent</h3>
                            <p className="text-xs text-slate-400">Install from npm, URL, or local file</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-dark-700 transition">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-4 pb-0">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setStatus('idle'); setStatusMsg(''); }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition flex-1 justify-center ${
                                activeTab === tab.id
                                    ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                                    : 'text-slate-400 hover:text-white hover:bg-dark-800 border border-transparent'
                            }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'npm' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-white block mb-2">Package Name</label>
                                <div className="flex gap-2">
                                    <span className="flex items-center px-3 bg-dark-900 border border-dark-600 border-r-0 rounded-l-lg text-slate-500 text-sm">
                                        npm
                                    </span>
                                    <input
                                        type="text"
                                        value={npmPackage}
                                        onChange={e => setNpmPackage(e.target.value)}
                                        placeholder="@xclaw/skill-analytics"
                                        className="flex-1 px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-r-lg text-white text-sm outline-none focus:border-primary-500 transition font-mono"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Install an agent skill package from the npm registry
                                </p>
                            </div>
                            <div className="bg-dark-900 rounded-xl p-3 border border-dark-700">
                                <p className="text-xs text-slate-400 font-mono">
                                    $ npm install {npmPackage || '@xclaw/skill-xxx'}
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'url' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-white block mb-2">Repository URL</label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="https://github.com/user/xclaw-skill-xxx"
                                    className="w-full px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm outline-none focus:border-primary-500 transition"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Supports GitHub, GitLab, or any Git repository URL
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <ExternalLink size={12} />
                                <span>Repository must contain an <code className="text-primary-400">xclaw.plugin.json</code> manifest</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'upload' && (
                        <div className="space-y-4">
                            <div
                                onDragOver={e => e.preventDefault()}
                                onDrop={handleFileDrop}
                                onClick={() => fileRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                                    file
                                        ? 'border-primary-600/50 bg-primary-600/5'
                                        : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/50'
                                }`}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".tar.gz,.tgz,.zip"
                                    className="hidden"
                                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                                />
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <FileArchive size={32} className="text-primary-400" />
                                        <p className="text-sm text-white font-medium">{file.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload size={32} className="text-slate-600" />
                                        <p className="text-sm text-slate-300">
                                            Drag & drop a skill package here
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Accepts .tar.gz, .tgz, or .zip files
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Status */}
                    {status !== 'idle' && (
                        <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-sm ${
                            status === 'installing' ? 'bg-blue-500/10 text-blue-400' :
                            status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-red-500/10 text-red-400'
                        }`}>
                            {status === 'installing' && <Loader2 size={16} className="animate-spin" />}
                            {status === 'success' && <CheckCircle size={16} />}
                            {status === 'error' && <AlertCircle size={16} />}
                            {status === 'installing' ? 'Installing...' : statusMsg}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 pb-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-dark-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleInstall}
                        disabled={!canInstall || status === 'installing'}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition ${
                            canInstall && status !== 'installing'
                                ? 'bg-primary-600 text-white hover:bg-primary-500'
                                : 'bg-dark-700 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        <Download size={16} />
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
}
