// ============================================================
// UserLayout - Clean user-facing interface
// ============================================================

import React, { useEffect } from 'react';
import { useAppStore, guardViewForRole } from '@/stores';
import { useAuthStore } from '@/stores/auth-store';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { KnowledgeBase } from '@/components/knowledge/KnowledgeBase';
import { ApiKeyManager } from '@/components/admin/ApiKeyManager';
import { MyLearning } from '@/components/doctor/MyLearning';
import { AgentHub } from '@/components/agent-hub/AgentHub';
import {
    MessageSquare, Database, Key, LogOut, Brain, Store,
} from 'lucide-react';

const USER_NAV = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'agent-hub', label: 'Agent Hub', icon: Store },
    { id: 'knowledge', label: 'Knowledge', icon: Database },
    { id: 'my-learning', label: 'My Learning', icon: Brain },
    { id: 'api-keys', label: 'API Keys', icon: Key },
] as const;

export function UserLayout() {
    const currentView = useAppStore(s => s.currentView);
    const setView = useAppStore(s => s.setView);
    const user = useAuthStore(s => s.user)!;
    const logout = useAuthStore(s => s.logout);

    // Guard: if hash points to an admin route, reset to chat
    useEffect(() => { guardViewForRole(user.role); }, []);

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-dark-900">
            {/* Top bar */}
            <header className="flex items-center justify-between px-5 h-14 bg-dark-950 border-b border-dark-700 flex-shrink-0">
                {/* Left: Logo + Nav */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <img src="/logo.svg" alt="xClaw" className="w-6 h-6" />
                        <span className="font-bold text-lg text-white tracking-tight">xClaw</span>
                    </div>

                    <nav className="flex items-center gap-1">
                        {USER_NAV.map(item => {
                            const active = currentView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setView(item.id as any)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${active
                                        ? 'bg-primary-600/20 text-primary-400'
                                        : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                                        }`}
                                >
                                    <item.icon size={16} />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: User info */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-600/30 flex items-center justify-center text-primary-300 text-xs font-bold">
                            {user.displayName[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-300">{user.displayName}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition rounded"
                        title="Logout"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {currentView === 'chat' && <ChatPanel />}
                {currentView === 'agent-hub' && <AgentHub />}
                {currentView === 'knowledge' && <KnowledgeBase />}
                {currentView === 'my-learning' && <MyLearning />}
                {currentView === 'api-keys' && <ApiKeyManager />}
            </main>
        </div>
    );
}
