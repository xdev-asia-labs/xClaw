// ============================================================
// ChatPanel - AI chat interface with per-user conversations
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { uuid } from '@/utils/uuid';
import { useChatStore } from '@/stores';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/utils/api';
import {
    Send, Trash2, Bot, User, Loader2, Plus, MessageSquare, Globe,
    ChevronDown, ChevronRight, ExternalLink, ThumbsUp, ThumbsDown,
    Database, Cpu, BarChart3, FileDown, ClipboardCheck, FileText, X,
} from 'lucide-react';

interface Conversation {
    id: string;
    title: string;
    updatedAt: string;
}

interface OllamaModel {
    name: string;
    size: number;
    modified_at: string;
}

export function ChatPanel() {
    const [input, setInput] = useState('');
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [searchStatus, setSearchStatus] = useState<string | null>(null);
    const [searchSources, setSearchSources] = useState<{ title: string; snippet: string; url: string }[]>([]);
    const [sourcesExpanded, setSourcesExpanded] = useState(false);
    const messages = useChatStore(s => s.messages);
    const isLoading = useChatStore(s => s.isLoading);
    const addMessage = useChatStore(s => s.addMessage);
    const updateMessage = useChatStore(s => s.updateMessage);
    const updateMessageMeta = useChatStore(s => s.updateMessageMeta);
    const setLoading = useChatStore(s => s.setLoading);
    const clearMessages = useChatStore(s => s.clearMessages);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sendingRef = useRef(false);
    const justSentRef = useRef(false);
    const composingRef = useRef(false);

    // Auth
    const user = useAuthStore(s => s.user);
    const isAdmin = user?.role === 'admin';

    // Model selector
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    // RAG debug toggle (admin only)
    const [ragDebugEnabled, setRagDebugEnabled] = useState(true);
    const [expandedRag, setExpandedRag] = useState<Set<string>>(new Set());

    // Tool picker
    const [showToolPicker, setShowToolPicker] = useState(false);
    const [selectedTool, setSelectedTool] = useState<string | null>(null);
    const toolPickerRef = useRef<HTMLDivElement>(null);

    const QUICK_TOOLS = [
        { id: 'generate_chart', label: 'Tạo biểu đồ', icon: BarChart3, color: 'text-violet-400 bg-violet-500/15 border-violet-500/30', hint: 'Mô tả dữ liệu & loại chart (bar, pie, line, area)' },
        { id: 'generate_report', label: 'Báo cáo', icon: FileText, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', hint: 'Nội dung / chủ đề cần báo cáo' },
        { id: 'export_chat_pdf', label: 'Xuất PDF', icon: FileDown, color: 'text-sky-400 bg-sky-500/15 border-sky-500/30', hint: 'Nội dung cần xuất (conversation, custom, doctor_report)' },
        { id: 'evaluate_learning_data', label: 'Đánh giá dữ liệu', icon: ClipboardCheck, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30', hint: 'Loại dữ liệu & tiêu chí đánh giá' },
    ];

    // Close tool picker on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (toolPickerRef.current && !toolPickerRef.current.contains(e.target as Node)) {
                setShowToolPicker(false);
            }
        };
        if (showToolPicker) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showToolPicker]);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);

    // Load conversations and models on mount
    useEffect(() => {
        clearMessages();
        setActiveConvId(null);
        loadConversations();
        loadModels();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadModels = async () => {
        try {
            const res = await api.getOllamaModels();
            const models = res?.models ?? res ?? [];
            setAvailableModels(models);
        } catch { /* ignore */ }
    };

    const loadConversations = async () => {
        try {
            const res = await api.getConversations();
            setConversations(res.conversations);
        } catch { /* ignore */ }
    };

    const selectConversation = async (convId: string) => {
        setActiveConvId(convId);
        clearMessages();
        try {
            const res = await api.getMessages(convId);
            for (const msg of res.messages) {
                addMessage({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.createdAt,
                });
            }
        } catch { /* ignore */ }
    };

    const newConversation = async () => {
        try {
            const conv = await api.createConversation();
            setConversations(prev => [conv, ...prev]);
            setActiveConvId(conv.id);
            clearMessages();
        } catch { /* ignore */ }
    };

    const deleteConversation = async (convId: string) => {
        try {
            await api.deleteConversation(convId);
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (activeConvId === convId) {
                setActiveConvId(null);
                clearMessages();
            }
        } catch { /* ignore */ }
    };

    const submitFeedback = async (messageId: string, rating: 'up' | 'down') => {
        try {
            await api.submitFeedback(messageId, rating);
            updateMessageMeta(messageId, { feedback: rating });
        } catch { /* ignore */ }
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isLoading || sendingRef.current) return;
        sendingRef.current = true;

        // Prepend tool instruction if a tool is selected
        const toolPrefix = selectedTool
            ? `[Use tool: ${selectedTool}] `
            : '';
        const fullText = toolPrefix + text;

        // Clear input & tool selection immediately before any async work
        justSentRef.current = true;
        setInput('');
        setSelectedTool(null);
        setTimeout(() => { justSentRef.current = false; }, 150);
        setLoading(true);

        // Auto-create conversation if none selected
        let convId = activeConvId;
        if (!convId) {
            try {
                const conv = await api.createConversation();
                convId = conv.id;
                setConversations(prev => [conv, ...prev]);
                setActiveConvId(convId);
            } catch {
                setLoading(false);
                sendingRef.current = false;
                return;
            }
        }
        addMessage({
            id: uuid(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        });

        setSearchStatus(null);
        setSearchSources([]);
        setSourcesExpanded(false);

        // Create placeholder assistant message for streaming
        const assistantMsgId = uuid();
        addMessage({
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            model: selectedModel || undefined,
        });

        try {
            const reader = await api.chatStream(convId!, fullText, webSearchEnabled, selectedModel || undefined);
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        if (data.type === 'delta') {
                            fullContent += data.content;
                            updateMessage(assistantMsgId, fullContent);
                        } else if (data.type === 'status') {
                            setSearchStatus(data.content);
                        } else if (data.type === 'search_done') {
                            setSearchStatus(null);
                            if (data.sources) setSearchSources(data.sources);
                        } else if (data.type === 'tool') {
                            setSearchStatus(data.content);
                        } else if (data.type === 'rag_context') {
                            try {
                                const chunks = JSON.parse(data.content);
                                updateMessageMeta(assistantMsgId, { ragContext: chunks });
                            } catch { /* ignore */ }
                        } else if (data.type === 'error') {
                            fullContent += `\n\nError: ${data.content}`;
                            updateMessage(assistantMsgId, fullContent);
                        } else if (data.type === 'done') {
                            setSearchStatus(null);
                        }
                    } catch { /* skip malformed lines */ }
                }
            }

            if (!fullContent) {
                updateMessage(assistantMsgId, '(No response)');
            }

            loadConversations();
        } catch (err: unknown) {
            updateMessage(assistantMsgId, `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`);
        } finally {
            setLoading(false);
            setSearchStatus(null);
            sendingRef.current = false;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleCompositionStart = () => { composingRef.current = true; };
    const handleCompositionEnd = () => { composingRef.current = false; };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (justSentRef.current) return;
        setInput(e.target.value);
    };

    const toggleRagExpand = (msgId: string) => {
        setExpandedRag(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    };

    return (
        <div className="flex h-full">
            {/* Conversation sidebar */}
            <div className="w-56 border-r border-dark-700 flex flex-col bg-dark-950/50">
                <div className="p-3 border-b border-dark-700">
                    <button
                        onClick={newConversation}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition"
                    >
                        <Plus size={14} /> New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => selectConversation(conv.id)}
                            className={`group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer text-sm transition ${activeConvId === conv.id
                                ? 'bg-primary-600/20 text-primary-300'
                                : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                                }`}
                        >
                            <MessageSquare size={14} className="flex-shrink-0" />
                            <span className="truncate flex-1">{conv.title}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 transition"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {conversations.length === 0 && (
                        <p className="text-xs text-slate-600 text-center mt-4 px-3">No conversations yet</p>
                    )}
                </div>
            </div>

            {/* Chat area */}
            <div className="flex flex-col flex-1 max-w-4xl mx-auto w-full">
                {/* Header with model selector */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-dark-700">
                    <div className="flex items-center gap-2">
                        <Bot size={20} className="text-primary-400" />
                        <h2 className="font-semibold text-white">xClaw Chat</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* RAG Debug toggle (admin only) */}
                        {isAdmin && (
                            <button
                                onClick={() => setRagDebugEnabled(v => !v)}
                                title={ragDebugEnabled ? 'RAG Debug ON' : 'RAG Debug OFF'}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${ragDebugEnabled
                                    ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-dark-700'
                                    }`}
                            >
                                <Database size={13} />
                                RAG
                            </button>
                        )}
                        {/* Model selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowModelDropdown(v => !v)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-dark-800 border border-dark-600 hover:border-dark-500 rounded-lg text-xs text-slate-300 transition"
                            >
                                <Cpu size={13} />
                                <span className="max-w-[120px] truncate">{selectedModel || 'Default model'}</span>
                                <ChevronDown size={12} />
                            </button>
                            {showModelDropdown && (
                                <div className="absolute right-0 top-full mt-1 w-64 bg-dark-800 border border-dark-600 rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                                    <button
                                        onClick={() => { setSelectedModel(''); setShowModelDropdown(false); }}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-dark-700 transition ${!selectedModel ? 'text-primary-400 bg-primary-600/10' : 'text-slate-300'}`}
                                    >
                                        Default (server config)
                                    </button>
                                    {availableModels.map(m => (
                                        <button
                                            key={m.name}
                                            onClick={() => { setSelectedModel(m.name); setShowModelDropdown(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-dark-700 transition ${selectedModel === m.name ? 'text-primary-400 bg-primary-600/10' : 'text-slate-300'}`}
                                        >
                                            <div className="font-medium">{m.name}</div>
                                            <div className="text-slate-500 text-[10px]">{(m.size / 1e9).toFixed(1)} GB</div>
                                        </button>
                                    ))}
                                    {availableModels.length === 0 && (
                                        <p className="px-3 py-2 text-xs text-slate-500">No Ollama models found</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <Bot size={48} className="mb-4 opacity-30" />
                            <p className="text-lg font-medium">xClaw Agent</p>
                            <p className="text-sm mt-1">Send a message to start a conversation</p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                                    <Bot size={16} className="text-primary-400" />
                                </div>
                            )}
                            <div className={`max-w-[75%] ${msg.role === 'user' ? '' : 'space-y-2'}`}>
                                <div
                                    className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-dark-800 text-slate-200 border border-dark-700'
                                        }`}
                                >
                                    {msg.role === 'assistant' ? (
                                        msg.content ? (
                                            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-code:text-primary-300 prose-code:bg-dark-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-dark-900 prose-pre:border prose-pre:border-dark-600 prose-pre:rounded-lg prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-blockquote:border-primary-500/50 prose-blockquote:text-slate-400 prose-th:text-slate-300 prose-td:text-slate-400">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({ href, children, ...props }) => {
                                                            const isDownload = href?.startsWith('/api/reports/download/');
                                                            if (isDownload) {
                                                                return (
                                                                    <a
                                                                        href={href}
                                                                        download
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 rounded-lg border border-primary-500/30 text-xs font-medium transition no-underline hover:no-underline"
                                                                        {...props}
                                                                    >
                                                                        {children}
                                                                    </a>
                                                                );
                                                            }
                                                            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                                                        },
                                                        code: ({ className, children, ...props }) => {
                                                            const match = /language-xclaw-chart/.exec(className || '');
                                                            if (match) {
                                                                try {
                                                                    const raw = String(children).replace(/\n$/, '');
                                                                    const parsed = JSON.parse(raw) as {
                                                                        type: string; title: string;
                                                                        data: Record<string, unknown>[] | string;
                                                                        xKey: string; yKeys: string[];
                                                                        colors: string[];
                                                                        width: number; height: number;
                                                                    };
                                                                    // Defensive: parse data if string
                                                                    let chartData = parsed.data;
                                                                    if (typeof chartData === 'string') {
                                                                        try { chartData = JSON.parse(chartData); } catch { chartData = []; }
                                                                    }
                                                                    if (!Array.isArray(chartData)) chartData = [];
                                                                    const spec = {
                                                                        ...parsed,
                                                                        data: chartData as Record<string, unknown>[],
                                                                        yKeys: (Array.isArray(parsed.yKeys) && parsed.yKeys.length > 0) ? parsed.yKeys : ['value'],
                                                                        colors: (Array.isArray(parsed.colors) && parsed.colors.length > 0) ? parsed.colors : ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'],
                                                                    };
                                                                    const COLORS = spec.colors;
                                                                    return (
                                                                        <div className="my-3 p-3 bg-dark-900 border border-dark-600 rounded-xl">
                                                                            <div className="text-xs font-semibold text-slate-300 mb-2">{spec.title}</div>
                                                                            <ResponsiveContainer width="100%" height={spec.height || 300}>
                                                                                {spec.type === 'bar' ? (
                                                                                    <BarChart data={spec.data}>
                                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                                                        <XAxis dataKey={spec.xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                                                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                                                                        {spec.yKeys.map((key, i) => (
                                                                                            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                                                                                        ))}
                                                                                    </BarChart>
                                                                                ) : spec.type === 'line' ? (
                                                                                    <LineChart data={spec.data}>
                                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                                                        <XAxis dataKey={spec.xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                                                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                                                                        {spec.yKeys.map((key, i) => (
                                                                                            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                                                                                        ))}
                                                                                    </LineChart>
                                                                                ) : spec.type === 'area' ? (
                                                                                    <AreaChart data={spec.data}>
                                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                                                        <XAxis dataKey={spec.xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                                                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                                                                        {spec.yKeys.map((key, i) => (
                                                                                            <Area key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                                                                                        ))}
                                                                                    </AreaChart>
                                                                                ) : spec.type === 'pie' ? (
                                                                                    <PieChart>
                                                                                        <Pie data={spec.data} dataKey={spec.yKeys[0] || 'value'} nameKey={spec.xKey} cx="50%" cy="50%" outerRadius={100} label={(props: { name?: string; percent?: number }) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`} labelLine={{ stroke: '#64748b' }}>
                                                                                            {spec.data.map((_, i) => (
                                                                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                                                            ))}
                                                                                        </Pie>
                                                                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                                                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                                                                    </PieChart>
                                                                                ) : spec.type === 'radar' ? (
                                                                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={spec.data}>
                                                                                        <PolarGrid stroke="#334155" />
                                                                                        <PolarAngleAxis dataKey={spec.xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <PolarRadiusAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                                                                                        {spec.yKeys.map((key, i) => (
                                                                                            <Radar key={key} name={key} dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                                                                                        ))}
                                                                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                                                                    </RadarChart>
                                                                                ) : (
                                                                                    <BarChart data={spec.data}>
                                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                                                        <XAxis dataKey={spec.xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                                                                                        {spec.yKeys.map((key, i) => (
                                                                                            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                                                                                        ))}
                                                                                    </BarChart>
                                                                                )}
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                    );
                                                                } catch {
                                                                    // If JSON parse fails, render as regular code block
                                                                }
                                                            }
                                                            // For pre > code blocks, check if parent is pre
                                                            const isBlock = /language-/.exec(className || '');
                                                            if (isBlock) {
                                                                return (
                                                                    <code className={className} {...props}>
                                                                        {children}
                                                                    </code>
                                                                );
                                                            }
                                                            return <code className={className} {...props}>{children}</code>;
                                                        },
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            isLoading ? <span className="inline-block w-2 h-4 bg-primary-400 animate-pulse rounded-sm" /> : null
                                        )
                                    ) : (
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    )}
                                    <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary-200' : 'text-slate-500'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                        {msg.model && <span className="ml-2 text-slate-600">{msg.model}</span>}
                                    </div>
                                </div>

                                {/* Feedback buttons (assistant messages only) */}
                                {msg.role === 'assistant' && msg.content && !isLoading && (
                                    <div className="flex items-center gap-1 px-1">
                                        <button
                                            onClick={() => submitFeedback(msg.id, 'up')}
                                            className={`p-1 rounded transition ${msg.feedback === 'up'
                                                ? 'text-green-400 bg-green-500/10'
                                                : 'text-slate-600 hover:text-green-400 hover:bg-green-500/10'
                                                }`}
                                            title="Good answer"
                                        >
                                            <ThumbsUp size={13} />
                                        </button>
                                        <button
                                            onClick={() => submitFeedback(msg.id, 'down')}
                                            className={`p-1 rounded transition ${msg.feedback === 'down'
                                                ? 'text-red-400 bg-red-500/10'
                                                : 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
                                                }`}
                                            title="Bad answer"
                                        >
                                            <ThumbsDown size={13} />
                                        </button>
                                    </div>
                                )}

                                {/* RAG Debug Panel (admin only) */}
                                {isAdmin && ragDebugEnabled && msg.role === 'assistant' && msg.ragContext && msg.ragContext.length > 0 && (
                                    <div className="bg-amber-900/10 border border-amber-600/20 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => toggleRagExpand(msg.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-900/20 transition"
                                        >
                                            {expandedRag.has(msg.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                            <Database size={12} />
                                            <span>RAG Context ({msg.ragContext.length} chunks)</span>
                                        </button>
                                        {expandedRag.has(msg.id) && (
                                            <div className="px-3 pb-3 space-y-2 border-t border-amber-600/20 pt-2">
                                                {msg.ragContext.map((chunk, i) => (
                                                    <div key={i} className="text-xs bg-dark-900/50 rounded-lg p-2.5 border border-dark-700">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-amber-400 font-medium">Chunk {i + 1}</span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${chunk.score >= 0.7 ? 'bg-green-500/20 text-green-400' :
                                                                chunk.score >= 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-red-500/20 text-red-400'
                                                                }`}>
                                                                {(chunk.score * 100).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-400 line-clamp-4 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
                                                        <div className="mt-1.5 text-[10px] text-slate-600">
                                                            Doc: {chunk.documentId?.slice(0, 8)}... | Collection: {chunk.collectionId?.slice(0, 8)}...
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                                    <User size={16} className="text-white" />
                                </div>
                            )}
                        </div>
                    ))}

                    {searchStatus && (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs text-primary-300 bg-primary-500/10 border border-primary-500/20 rounded-lg">
                            <Loader2 size={14} className="animate-spin" />
                            <span>{searchStatus}</span>
                        </div>
                    )}

                    {searchSources.length > 0 && (
                        <div className="bg-dark-800/80 border border-dark-700 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setSourcesExpanded(v => !v)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-blue-400 hover:bg-dark-700/50 transition"
                            >
                                {sourcesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <Globe size={13} />
                                <span>Sources ({searchSources.length})</span>
                                <span className="flex-1" />
                                <span className="text-slate-500 font-normal">
                                    {searchSources.slice(0, 3).map(s => {
                                        try { return new URL(s.url).hostname; } catch { return ''; }
                                    }).filter(Boolean).join(', ')}
                                </span>
                            </button>
                            {sourcesExpanded && (
                                <div className="px-3 pb-3 space-y-2 border-t border-dark-700 pt-2">
                                    {searchSources.map((src, i) => (
                                        <div key={i} className="flex gap-2.5 items-start text-xs group">
                                            <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">{i + 1}</span>
                                            <div className="min-w-0 flex-1">
                                                {src.url ? (
                                                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 font-medium hover:underline flex items-center gap-1">
                                                        <span className="truncate">{src.title}</span>
                                                        <ExternalLink size={10} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-300 font-medium truncate block">{src.title}</span>
                                                )}
                                                <p className="text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{src.snippet}</p>
                                                {src.url && <span className="text-slate-600 text-[10px] truncate block mt-0.5">{(() => { try { return new URL(src.url).hostname; } catch { return src.url; } })()}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-6 py-4 border-t border-dark-700">
                    {/* Selected tool badge */}
                    {selectedTool && (() => {
                        const t = QUICK_TOOLS.find(q => q.id === selectedTool);
                        if (!t) return null;
                        const Icon = t.icon;
                        return (
                            <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg border text-xs ${t.color}`}>
                                <Icon size={14} />
                                <span className="font-medium">{t.label}</span>
                                <span className="text-slate-500 ml-1">— {t.hint}</span>
                                <button onClick={() => setSelectedTool(null)} className="ml-auto hover:text-white transition"><X size={12} /></button>
                            </div>
                        );
                    })()}

                    <div className="flex items-end gap-2 bg-dark-800 border border-dark-700 rounded-xl p-2 focus-within:border-primary-500 transition">
                        {/* Tool picker button */}
                        <div className="relative" ref={toolPickerRef}>
                            <button
                                onClick={() => setShowToolPicker(v => !v)}
                                title="Chọn công cụ"
                                className={`p-2 rounded-lg transition flex-shrink-0 ${showToolPicker || selectedTool
                                        ? 'bg-primary-600/20 text-primary-400 hover:bg-primary-600/30'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-dark-700'
                                    }`}
                            >
                                <Plus size={16} />
                            </button>
                            {showToolPicker && (
                                <div className="absolute bottom-full left-0 mb-2 w-56 bg-dark-800 border border-dark-600 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                    <div className="px-3 py-2 border-b border-dark-600">
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Công cụ</span>
                                    </div>
                                    {QUICK_TOOLS.map(tool => {
                                        const Icon = tool.icon;
                                        return (
                                            <button
                                                key={tool.id}
                                                onClick={() => {
                                                    setSelectedTool(tool.id);
                                                    setShowToolPicker(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-dark-700 ${selectedTool === tool.id ? 'bg-dark-700' : ''
                                                    }`}
                                            >
                                                <div className={`p-1.5 rounded-lg border ${tool.color}`}>
                                                    <Icon size={14} />
                                                </div>
                                                <span className="text-slate-200">{tool.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setWebSearchEnabled(v => !v)}
                            title={webSearchEnabled ? 'Web search ON' : 'Web search OFF'}
                            className={`p-2 rounded-lg transition flex-shrink-0 ${webSearchEnabled
                                ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-dark-700'
                                }`}
                        >
                            <Globe size={16} />
                        </button>
                        <textarea
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onCompositionStart={handleCompositionStart}
                            onCompositionEnd={handleCompositionEnd}
                            placeholder={selectedTool
                                ? QUICK_TOOLS.find(t => t.id === selectedTool)?.hint || 'Type a message...'
                                : webSearchEnabled ? 'Search the web & ask...' : 'Type a message...'}
                            rows={1}
                            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none outline-none px-2 py-1 max-h-32"
                            style={{ minHeight: '36px' }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="p-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition flex-shrink-0"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    {webSearchEnabled && (
                        <div className="flex items-center gap-1.5 mt-1.5 px-1 text-[11px] text-blue-400">
                            <Globe size={10} />
                            <span>Web search enabled — results will be used as context</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
