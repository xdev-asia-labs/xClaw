// ============================================================
// ChatPanel - AI chat interface with per-user conversations
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { uuid } from '../../utils/uuid.js';
import { useChatStore } from '../../stores';
import { api } from '../../utils/api';
import { Send, Trash2, Bot, User, Loader2, Plus, MessageSquare, Globe, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface Conversation {
    id: string;
    title: string;
    updatedAt: string;
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
    const setLoading = useChatStore(s => s.setLoading);
    const clearMessages = useChatStore(s => s.clearMessages);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);

    // Load conversations on mount & clear stale messages
    useEffect(() => {
        clearMessages();
        setActiveConvId(null);
        loadConversations();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        // Auto-create conversation if none selected
        let convId = activeConvId;
        if (!convId) {
            try {
                const conv = await api.createConversation();
                convId = conv.id;
                setConversations(prev => [conv, ...prev]);
                setActiveConvId(convId);
            } catch {
                return;
            }
        }

        setInput('');
        addMessage({
            id: uuid(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        });

        setLoading(true);
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
        });

        try {
            const reader = await api.chatStream(convId, text, webSearchEnabled);
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
                        } else if (data.type === 'error') {
                            fullContent += `\n\nError: ${data.content}`;
                            updateMessage(assistantMsgId, fullContent);
                        } else if (data.type === 'done') {
                            setSearchStatus(null);
                        }
                    } catch { /* skip malformed lines */ }
                }
            }

            // If no content was received, show fallback
            if (!fullContent) {
                updateMessage(assistantMsgId, '(No response)');
            }

            // Refresh conversation list (title may have changed)
            loadConversations();
        } catch (err: unknown) {
            updateMessage(assistantMsgId, `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`);
        } finally {
            setLoading(false);
            setSearchStatus(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
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
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-dark-700">
                    <div className="flex items-center gap-2">
                        <Bot size={20} className="text-primary-400" />
                        <h2 className="font-semibold text-white">AutoX Chat</h2>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <Bot size={48} className="mb-4 opacity-30" />
                            <p className="text-lg font-medium">AutoX Agent</p>
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
                            <div
                                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-800 text-slate-200 border border-dark-700'
                                    }`}
                            >
                                {msg.role === 'assistant' ? (
                                    msg.content ? (
                                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-code:text-primary-300 prose-code:bg-dark-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-dark-900 prose-pre:border prose-pre:border-dark-600 prose-pre:rounded-lg prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-blockquote:border-primary-500/50 prose-blockquote:text-slate-400 prose-th:text-slate-300 prose-td:text-slate-400">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        isLoading ? <span className="inline-block w-2 h-4 bg-primary-400 animate-pulse rounded-sm" /> : null
                                    )
                                ) : (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                )}
                                <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary-200' : 'text-slate-500'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
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
                    <div className="flex items-end gap-2 bg-dark-800 border border-dark-700 rounded-xl p-2 focus-within:border-primary-500 transition">
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
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={webSearchEnabled ? 'Search the web & ask...' : 'Type a message...'}
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
