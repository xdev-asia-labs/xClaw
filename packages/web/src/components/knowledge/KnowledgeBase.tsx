import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { Modal, ErrorBanner, Spinner, Button } from '@/components/ui';
import { formatBytes, formatDate } from '@/utils/format';
import {
    Database, Plus, Trash2, FileText, Globe, Upload,
    Search, FolderOpen,
    Hash, Layers, CheckCircle, AlertCircle,
    Loader2,
} from 'lucide-react';

interface KBCollection {
    collectionId: string;
    name: string;
    description?: string;
    documentCount: number;
    chunkCount: number;
    totalTokens: number;
    totalSizeBytes: number;
    embeddingModel: string;
    chunkConfig: { strategy: string; maxTokens: number; overlap: number };
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

interface KBDocument {
    documentId: string;
    collectionId: string;
    name: string;
    source: string;
    mimeType: string;
    sizeBytes: number;
    status: 'processing' | 'ready' | 'error';
    chunkCount: number;
    error?: string;
    createdAt: string;
}

interface SearchResult {
    content: string;
    score: number;
    collectionId: string;
    documentId: string;
}

type ModalType = 'create-collection' | 'add-document' | 'search' | null;

export function KnowledgeBase() {
    const [collections, setCollections] = useState<KBCollection[]>([]);
    const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
    const [documents, setDocuments] = useState<KBDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [docsLoading, setDocsLoading] = useState(false);
    const [modal, setModal] = useState<ModalType>(null);
    const [error, setError] = useState<string | null>(null);

    // Create collection form
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newStrategy, setNewStrategy] = useState('recursive');
    const [newMaxTokens, setNewMaxTokens] = useState(512);
    const [newOverlap, setNewOverlap] = useState(50);

    // Add document form
    const [docSource, setDocSource] = useState<'text' | 'url' | 'file'>('text');
    const [docInput, setDocInput] = useState('');
    const [docName, setDocName] = useState('');
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docAdding, setDocAdding] = useState(false);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const loadCollections = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getKBCollections();
            setCollections(data.collections ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load collections');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadDocuments = useCallback(async (collectionId: string) => {
        try {
            setDocsLoading(true);
            const data = await api.getKBDocuments(collectionId);
            setDocuments(data.documents ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load documents');
        } finally {
            setDocsLoading(false);
        }
    }, []);

    useEffect(() => { loadCollections(); }, [loadCollections]);

    useEffect(() => {
        if (selectedCollection) loadDocuments(selectedCollection);
        else setDocuments([]);
    }, [selectedCollection, loadDocuments]);

    const handleCreateCollection = async () => {
        if (!newName.trim()) return;
        try {
            await api.createKBCollection({
                name: newName.trim(),
                description: newDesc.trim() || undefined,
                chunk_strategy: newStrategy,
                max_tokens: newMaxTokens,
                overlap: newOverlap,
            });
            setModal(null);
            setNewName('');
            setNewDesc('');
            await loadCollections();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create collection');
        }
    };

    const handleDeleteCollection = async (id: string) => {
        if (!confirm('Delete this collection and all its documents?')) return;
        try {
            await api.deleteKBCollection(id);
            if (selectedCollection === id) setSelectedCollection(null);
            await loadCollections();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete collection');
        }
    };

    const handleAddDocument = async () => {
        if (!selectedCollection) return;
        if (docSource === 'file' && !docFile) return;
        if (docSource !== 'file' && !docInput.trim()) return;
        try {
            setDocAdding(true);
            if (docSource === 'file' && docFile) {
                await api.uploadKBFile(selectedCollection, docFile, docName.trim() || undefined);
            } else {
                await api.addKBDocument(selectedCollection, {
                    source: docSource,
                    input: docInput.trim(),
                    name: docName.trim() || undefined,
                });
            }
            setModal(null);
            setDocInput('');
            setDocName('');
            setDocFile(null);
            await loadDocuments(selectedCollection);
            await loadCollections(); // Refresh stats
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add document');
        } finally {
            setDocAdding(false);
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (!selectedCollection) return;
        try {
            await api.deleteKBDocument(selectedCollection, docId);
            await loadDocuments(selectedCollection);
            await loadCollections();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete document');
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            setSearching(true);
            const data = await api.searchKB(
                searchQuery.trim(),
                selectedCollection ? [selectedCollection] : undefined,
                10,
            );
            setSearchResults(data.results ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setSearching(false);
        }
    };

    const selectedCol = collections.find(c => c.collectionId === selectedCollection);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="flex items-center gap-3 px-6 py-4 border-b border-dark-700">
                <Database size={22} className="text-primary-400" />
                <h2 className="text-lg font-semibold text-white">Knowledge Base</h2>
                <span className="text-xs text-slate-500">RAG Document Management</span>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setModal('search')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition"
                    >
                        <Search size={14} /> Search KB
                    </button>
                    <button
                        onClick={() => setModal('create-collection')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition"
                    >
                        <Plus size={14} /> New Collection
                    </button>
                </div>
            </header>

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            <div className="flex flex-1 overflow-hidden">
                {/* Left: Collections list */}
                <div className="w-80 border-r border-dark-700 flex flex-col overflow-y-auto">
                    <div className="px-4 py-3 text-xs text-slate-500 uppercase tracking-wider font-medium">
                        Collections ({collections.length})
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size={20} />
                        </div>
                    ) : collections.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-500 text-sm">
                            <Database size={32} className="mx-auto mb-2 opacity-40" />
                            <p>No collections yet</p>
                            <p className="text-xs mt-1">Create one to start adding documents</p>
                        </div>
                    ) : (
                        <div className="space-y-1 px-2">
                            {collections.map(col => (
                                <button
                                    key={col.collectionId}
                                    onClick={() => setSelectedCollection(
                                        selectedCollection === col.collectionId ? null : col.collectionId
                                    )}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg transition group ${selectedCollection === col.collectionId
                                        ? 'bg-primary-600/20 border border-primary-500/30'
                                        : 'hover:bg-dark-800 border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FolderOpen size={16} className={
                                            selectedCollection === col.collectionId ? 'text-primary-400' : 'text-slate-500'
                                        } />
                                        <span className="font-medium text-sm text-white truncate flex-1">
                                            {col.name}
                                        </span>
                                        <button
                                            onClick={e => { e.stopPropagation(); handleDeleteCollection(col.collectionId); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    {col.description && (
                                        <p className="text-xs text-slate-500 mt-1 ml-6 line-clamp-1">{col.description}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1.5 ml-6 text-xs text-slate-500">
                                        <span className="flex items-center gap-1"><FileText size={10} />{col.documentCount} docs</span>
                                        <span className="flex items-center gap-1"><Layers size={10} />{col.chunkCount} chunks</span>
                                        <span>{formatBytes(col.totalSizeBytes)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Document list / details */}
                <div className="flex-1 flex flex-col overflow-y-auto">
                    {!selectedCollection ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500">
                            <div className="text-center">
                                <Database size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Select a collection to view documents</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Collection header */}
                            <div className="px-6 py-4 border-b border-dark-700">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <h3 className="text-white font-semibold">{selectedCol?.name}</h3>
                                        {selectedCol?.description && (
                                            <p className="text-sm text-slate-400 mt-0.5">{selectedCol.description}</p>
                                        )}
                                    </div>
                                    <div className="ml-auto flex items-center gap-2">
                                        <button
                                            onClick={() => setModal('add-document')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition"
                                        >
                                            <Upload size={14} /> Add Document
                                        </button>
                                    </div>
                                </div>

                                {/* Stats bar */}
                                {selectedCol && (
                                    <div className="flex items-center gap-4 mt-3 text-xs">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-800 rounded-md text-slate-400">
                                            <FileText size={12} /> {selectedCol.documentCount} documents
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-800 rounded-md text-slate-400">
                                            <Layers size={12} /> {selectedCol.chunkCount} chunks
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-800 rounded-md text-slate-400">
                                            <Hash size={12} /> {selectedCol.totalTokens.toLocaleString()} tokens
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-800 rounded-md text-slate-400">
                                            Strategy: {selectedCol.chunkConfig.strategy}
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-800 rounded-md text-slate-400">
                                            Embedding: {selectedCol.embeddingModel}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Documents */}
                            <div className="flex-1 px-6 py-4">
                                {docsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Spinner size={20} />
                                    </div>
                                ) : documents.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <FileText size={32} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">No documents in this collection</p>
                                        <p className="text-xs mt-1">Add text, URLs, or files to build your knowledge base</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {documents.map(doc => (
                                            <div key={doc.documentId} className="flex items-center gap-3 px-4 py-3 bg-dark-800 rounded-lg group">
                                                <div className="flex-shrink-0">
                                                    {doc.source === 'url' ? (
                                                        <Globe size={18} className="text-blue-400" />
                                                    ) : (
                                                        <FileText size={18} className="text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-white truncate">{doc.name}</span>
                                                        {doc.status === 'ready' && <CheckCircle size={12} className="text-green-400 flex-shrink-0" />}
                                                        {doc.status === 'processing' && <Loader2 size={12} className="text-yellow-400 animate-spin flex-shrink-0" />}
                                                        {doc.status === 'error' && <AlertCircle size={12} className="text-red-400 flex-shrink-0" />}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                                        <span>{doc.source}</span>
                                                        <span>{doc.chunkCount} chunks</span>
                                                        <span>{formatBytes(doc.sizeBytes)}</span>
                                                        <span>{formatDate(doc.createdAt)}</span>
                                                    </div>
                                                    {doc.error && <p className="text-xs text-red-400 mt-1">{doc.error}</p>}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDocument(doc.documentId)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Modals ───────────────────────────────────────── */}

            {/* Create Collection Modal */}
            <Modal open={modal === 'create-collection'} title="New Collection" onClose={() => setModal(null)}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Name *</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                            placeholder="e.g. Company Docs"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Description</label>
                        <input
                            type="text"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                            placeholder="What's this collection for?"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Chunk Strategy</label>
                            <select
                                value={newStrategy}
                                onChange={e => setNewStrategy(e.target.value)}
                                className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                            >
                                <option value="recursive">Recursive</option>
                                <option value="sentence">Sentence</option>
                                <option value="paragraph">Paragraph</option>
                                <option value="fixed">Fixed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Max Tokens</label>
                            <input
                                type="number"
                                value={newMaxTokens}
                                onChange={e => setNewMaxTokens(Number(e.target.value))}
                                className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                                min={64} max={4096}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Overlap</label>
                            <input
                                type="number"
                                value={newOverlap}
                                onChange={e => setNewOverlap(Number(e.target.value))}
                                className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                                min={0} max={200}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateCollection}
                            disabled={!newName.trim()}
                            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition disabled:opacity-50"
                        >
                            Create Collection
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Add Document Modal */}
            <Modal open={modal === 'add-document'} title="Add Document" onClose={() => setModal(null)}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Source Type</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDocSource('text')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${docSource === 'text' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-slate-400 hover:text-white'
                                    }`}
                            >
                                <FileText size={14} /> Text / Markdown
                            </button>
                            <button
                                onClick={() => setDocSource('url')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${docSource === 'url' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Globe size={14} /> URL
                            </button>
                            <button
                                onClick={() => setDocSource('file')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition ${docSource === 'file' ? 'bg-primary-600 text-white' : 'bg-dark-800 text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Upload size={14} /> Upload File
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Name (optional)</label>
                        <input
                            type="text"
                            value={docName}
                            onChange={e => setDocName(e.target.value)}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                            placeholder="Document name"
                        />
                    </div>
                    <div>
                        {docSource === 'file' ? (
                            <>
                                <label className="block text-sm text-slate-400 mb-1">File *</label>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-dark-600 rounded-lg cursor-pointer hover:border-primary-500 transition bg-dark-900">
                                    <Upload size={24} className="text-slate-500 mb-2" />
                                    <span className="text-sm text-slate-400">{docFile ? docFile.name : 'Click to select file'}</span>
                                    <span className="text-xs text-slate-600 mt-1">PDF, XLSX, DOCX, CSV, TXT, MD, JSON</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.xlsx,.xls,.docx,.csv,.txt,.md,.json,.xml,.html,.yaml,.yml"
                                        onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (f) { setDocFile(f); if (!docName) setDocName(f.name); }
                                        }}
                                    />
                                </label>
                                {docFile && <p className="text-xs text-slate-500 mt-1">{(docFile.size / 1024).toFixed(1)} KB</p>}
                            </>
                        ) : (
                            <>
                                <label className="block text-sm text-slate-400 mb-1">
                                    {docSource === 'text' ? 'Content *' : 'URL *'}
                                </label>
                                {docSource === 'text' ? (
                                    <textarea
                                        value={docInput}
                                        onChange={e => setDocInput(e.target.value)}
                                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none h-40 resize-none font-mono"
                                        placeholder="Paste your text or markdown here..."
                                    />
                                ) : (
                                    <input
                                        type="url"
                                        value={docInput}
                                        onChange={e => setDocInput(e.target.value)}
                                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                                        placeholder="https://example.com/article"
                                    />
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                            Cancel
                        </button>
                        <button
                            onClick={handleAddDocument}
                            disabled={(docSource === 'file' ? !docFile : !docInput.trim()) || docAdding}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition disabled:opacity-50"
                        >
                            {docAdding && <Loader2 size={14} className="animate-spin" />}
                            {docAdding ? 'Processing...' : 'Add Document'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Search Modal */}
            <Modal open={modal === 'search'} title="Semantic Search" onClose={() => { setModal(null); setSearchResults([]); }} size="lg">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
                            placeholder="Search across your knowledge base..."
                            autoFocus
                        />
                        <button
                            onClick={handleSearch}
                            disabled={!searchQuery.trim() || searching}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition disabled:opacity-50"
                        >
                            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            Search
                        </button>
                    </div>

                    {selectedCollection && (
                        <p className="text-xs text-slate-500">
                            Searching in: <span className="text-primary-400">{selectedCol?.name}</span>
                            {' '}<button onClick={() => setSelectedCollection(null)} className="text-slate-500 hover:text-white">(search all)</button>
                        </p>
                    )}

                    {searchResults.length > 0 && (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {searchResults.map((result, i) => (
                                <div key={i} className="px-4 py-3 bg-dark-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-600/30 text-primary-300 text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <span className="text-xs text-slate-500">Score: {(result.score * 100).toFixed(1)}%</span>
                                    </div>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">{result.content}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {searchResults.length === 0 && searchQuery && !searching && (
                        <p className="text-sm text-slate-500 text-center py-4">No results. Try a different query.</p>
                    )}
                </div>
            </Modal>
        </div>
    );
}
