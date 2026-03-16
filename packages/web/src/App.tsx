// ============================================================
// App - Main Application Layout
// ============================================================

import React, { useEffect } from 'react';
import { useAppStore } from './stores';
import { useAuthStore } from './stores/auth-store';
import { LoginPage } from './components/auth/LoginPage';
import { ChatPanel } from './components/chat/ChatPanel';
import { WorkflowCanvas } from './components/workflow/WorkflowCanvas';
import { HealthDashboard } from './components/dashboard/HealthDashboard';
import { SkillsPanel } from './components/skills/SkillsPanel';
import { KnowledgeBase } from './components/knowledge/KnowledgeBase';
import { ResourcesDashboard } from './components/resources/ResourcesDashboard';
import { Settings } from './components/settings/Settings';
import {
    MessageSquare, Workflow, HeartPulse, Puzzle,
    Database, BarChart3,
    Settings as SettingsIcon, Menu, Zap, LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'knowledge' as const, label: 'Knowledge', icon: Database },
    { id: 'workflows' as const, label: 'Workflows', icon: Workflow },
    { id: 'skills' as const, label: 'Skills', icon: Puzzle },
    { id: 'resources' as const, label: 'Resources', icon: BarChart3 },
    { id: 'health-dashboard' as const, label: 'Health', icon: HeartPulse },
    { id: 'settings' as const, label: 'Settings', icon: SettingsIcon },
];

function App() {
    const currentView = useAppStore(s => s.currentView);
    const setView = useAppStore(s => s.setView);
    const sidebarOpen = useAppStore(s => s.sidebarOpen);
    const toggleSidebar = useAppStore(s => s.toggleSidebar);
    const user = useAuthStore(s => s.user);
    const authLoading = useAuthStore(s => s.isLoading);
    const logout = useAuthStore(s => s.logout);
    const restoreSession = useAuthStore(s => s.restoreSession);

    useEffect(() => {
        restoreSession();
    }, []);

    // Show loading while restoring session
    if (authLoading && !user) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-dark-950">
                <Zap size={32} className="text-primary-400 animate-pulse" />
            </div>
        );
    }

    // Show login if not authenticated
    if (!user) {
        return <LoginPage />;
    }

    return (
        <div className="h-screen w-screen flex overflow-hidden bg-dark-900">
            {/* Sidebar */}
            <aside
                className={`flex flex-col bg-dark-950 border-r border-dark-700 transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-16'
                    }`}
            >
                {/* Logo */}
                <div className="flex items-center gap-2 px-4 h-14 border-b border-dark-700">
                    <Zap size={22} className="text-primary-400 flex-shrink-0" />
                    {sidebarOpen && (
                        <span className="font-bold text-lg text-white tracking-tight">AutoX</span>
                    )}
                    <button
                        onClick={toggleSidebar}
                        className="ml-auto p-1 hover:bg-dark-800 rounded text-slate-400"
                    >
                        <Menu size={18} />
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 py-3 px-2 space-y-1">
                    {NAV_ITEMS.map(item => {
                        const active = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active
                                    ? 'bg-primary-600/20 text-primary-400'
                                    : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                                    }`}
                                title={item.label}
                            >
                                <item.icon size={20} className="flex-shrink-0" />
                                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer - User */}
                <div className="px-3 py-3 border-t border-dark-700">
                    {sidebarOpen ? (
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-600/30 flex items-center justify-center text-primary-300 text-xs font-bold flex-shrink-0">
                                {user.displayName[0].toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-400 truncate flex-1">{user.displayName}</span>
                            <button onClick={logout} className="p-1 text-slate-500 hover:text-red-400 transition" title="Logout">
                                <LogOut size={14} />
                            </button>
                        </div>
                    ) : (
                        <button onClick={logout} className="w-full flex justify-center p-1 text-slate-500 hover:text-red-400 transition" title="Logout">
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {currentView === 'chat' && <ChatPanel />}
                {currentView === 'knowledge' && <KnowledgeBase />}
                {currentView === 'workflows' && <WorkflowCanvas />}
                {currentView === 'skills' && <SkillsPanel />}
                {currentView === 'resources' && <ResourcesDashboard />}
                {currentView === 'health-dashboard' && <HealthDashboard />}
                {currentView === 'settings' && <Settings />}
            </main>
        </div>
    );
}

export default App;
