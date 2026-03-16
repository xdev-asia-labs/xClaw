// ============================================================
// ChatPanel - AI chat interface with per-user conversations
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { uuid } from '../../utils/uuid.js';
import { useChatStore } from '../../stores';
import { api } from '../../utils/api';
import { Send, Trash2, Bot, User, Loader2, Plus, MessageSquare } from 'lucide-react';

interface Conversation {
    id: string;
    title: string;
    updatedAt: string;
}

export function ChatPanel() {
    const [input, setInput] = useState('');
    const messages = useChatStore(s => s.messages);
    const isLoading = useChatStore(s => s.isLoading);
    const addMessage = useChatStore(s => s.addMessage);
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
        try {
            const res = await api.chat(convId, text);
            addMessage({
                id: uuid(),
                role: 'assistant',
                content: res.response,
                timestamp: new Date().toISOString(),
            });
            // Refresh conversation list (title may have changed)
            loadConversations();
        } catch (err: unknown) {
            addMessage({
                id: uuid(),
                role: 'assistant',
                content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
                timestamp: new Date().toISOString(),
            });
        } finally {
            setLoading(false);
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
                                <div className="whitespace-pre-wrap">{msg.content}</div>
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

                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                                <Bot size={16} className="text-primary-400" />
                            </div>
                            <div className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3">
                                <Loader2 size={16} className="animate-spin text-primary-400" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-6 py-4 border-t border-dark-700">
                    <div className="flex items-end gap-2 bg-dark-800 border border-dark-700 rounded-xl p-2 focus-within:border-primary-500 transition">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none outline-none px-2 py-1 max-h-32"
                            style={{ minHeight: '36px' }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="p-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
