// ============================================================
// AdminLayout - Multi-tenant style administration dashboard
// ============================================================

import React, { useState } from 'react';
import { useAppStore } from '@/stores';
import { useAuthStore } from '@/stores/auth-store';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { HealthDashboard } from '@/components/dashboard/HealthDashboard';
import { SkillsPanel } from '@/components/skills/SkillsPanel';
import { KnowledgeBase } from '@/components/knowledge/KnowledgeBase';
import { ResourcesDashboard } from '@/components/resources/ResourcesDashboard';
import { Settings } from '@/components/settings/Settings';
import { UserManagement } from '@/components/admin/UserManagement';
import { ChannelManagement } from '@/components/admin/ChannelManagement';
import { ApiKeyManager } from '@/components/admin/ApiKeyManager';
import { ModelManagement } from '@/components/admin/ModelManagement';
import { AuditLog } from '@/components/admin/AuditLog';
import { Analytics } from '@/components/admin/Analytics';
import { MCPPanel } from '@/components/admin/MCPPanel';
import { AgentHub } from '@/components/agent-hub/AgentHub';
import { DataQualityOverview } from '@/components/admin/DataQualityOverview';
import { DoctorProfiles } from '@/components/admin/DoctorProfiles';
import { LearningDataReview } from '@/components/admin/LearningDataReview';
import { FineTuningStudio } from '@/components/admin/FineTuningStudio';
import { ChatAnalysis } from '@/components/admin/ChatAnalysis';
import {
    MessageSquare, Workflow, HeartPulse, Puzzle,
    Database, BarChart3, Users, Radio, Key,
    Settings as SettingsIcon, LogOut, Shield,
    ChevronLeft, ChevronRight, Bell, Search,
    LayoutDashboard, ChevronDown, Brain, ScrollText, TrendingUp, Plug,
    UserCog, BookOpen, Sparkles, MessageSquareText, ShieldCheck,
    Store,
} from 'lucide-react';

// ── Nav config ──────────────────────────────────────────────

type NavSection = {
    title: string;
    items: { id: string; label: string; icon: React.ElementType; badge?: string }[];
};

const NAV_SECTIONS: NavSection[] = [
    {
        title: 'OVERVIEW',
        items: [
            { id: 'resources', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'health-dashboard', label: 'Health Monitor', icon: HeartPulse },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        ],
    },
    {
        title: 'OPERATIONS',
        items: [
            { id: 'agent-hub', label: 'Agent Hub', icon: Store, badge: 'NEW' },
            { id: 'chat', label: 'Chat Console', icon: MessageSquare },
            { id: 'knowledge', label: 'Knowledge Base', icon: Database },
            { id: 'workflows', label: 'Workflows', icon: Workflow },
            { id: 'skills', label: 'Skills & Tools', icon: Puzzle },
            { id: 'models', label: 'Models', icon: Brain },
            { id: 'mcp-servers', label: 'MCP Integrations', icon: Plug },
        ],
    },
    {
        title: 'DOCTOR MANAGEMENT',
        items: [
            { id: 'doctor-profiles', label: 'Doctor Profiles', icon: UserCog },
            { id: 'learning-data', label: 'Learning Data', icon: BookOpen },
            { id: 'data-quality', label: 'Data Quality', icon: ShieldCheck },
            { id: 'finetune-studio', label: 'Fine-Tuning Studio', icon: Sparkles },
            { id: 'chat-analysis', label: 'Chat Analysis', icon: MessageSquareText },
        ],
    },
    {
        title: 'ADMINISTRATION',
        items: [
            { id: 'users', label: 'Users', icon: Users },
            { id: 'channels', label: 'Channels', icon: Radio },
            { id: 'api-keys', label: 'API Keys', icon: Key },
            { id: 'audit-log', label: 'Audit Log', icon: ScrollText },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ],
    },
];

// Title map for the top header
const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
    resources: { title: 'Dashboard', subtitle: 'System overview and metrics' },
    'health-dashboard': { title: 'Health Monitor', subtitle: 'Service status and performance' },
    analytics: { title: 'Analytics', subtitle: 'Usage statistics and insights' },
    chat: { title: 'Chat Console', subtitle: 'AI conversation interface' },
    'agent-hub': { title: 'Agent Hub', subtitle: 'Browse & install AI agents' },
    knowledge: { title: 'Knowledge Base', subtitle: 'Document collections and RAG' },
    workflows: { title: 'Workflows', subtitle: 'Automation pipeline builder' },
    skills: { title: 'Skills & Tools', subtitle: 'Manage agent capabilities' },
    models: { title: 'Model Management', subtitle: 'LLM model registry and providers' },
    users: { title: 'User Management', subtitle: 'Accounts, roles and permissions' },
    channels: { title: 'Channel Management', subtitle: 'Telegram, Discord and integrations' },
    'api-keys': { title: 'API Keys', subtitle: 'Access tokens and embed widgets' },
    'audit-log': { title: 'Audit Log', subtitle: 'System activity and security events' },
    'mcp-servers': { title: 'MCP Integrations', subtitle: 'External tools & data sources via MCP' },
    'doctor-profiles': { title: 'Doctor Profiles', subtitle: 'Per-doctor AI personalization' },
    'learning-data': { title: 'Learning Data', subtitle: 'Review auto-extracted learning entries' },
    'data-quality': { title: 'Data Quality', subtitle: 'Learning data quality metrics' },
    'finetune-studio': { title: 'Fine-Tuning Studio', subtitle: 'Datasets, samples, and training jobs' },
    'chat-analysis': { title: 'Chat Analysis', subtitle: 'Per-doctor conversation insights' },
    settings: { title: 'Settings', subtitle: 'Agent configuration' },
};

// ── Component ───────────────────────────────────────────────

export function AdminLayout() {
    const currentView = useAppStore(s => s.currentView);
    const setView = useAppStore(s => s.setView);
    const user = useAuthStore(s => s.user)!;
    const logout = useAuthStore(s => s.logout);
    const [collapsed, setCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const viewInfo = VIEW_TITLES[currentView] ?? { title: 'xClaw', subtitle: '' };

    return (
        <div className="h-screen w-screen flex overflow-hidden bg-dark-900">
            {/* ─── Sidebar ─── */}
            <aside
                className={`flex flex-col bg-dark-950 border-r border-dark-700 transition-all duration-200 flex-shrink-0 ${collapsed ? 'w-[68px]' : 'w-60'
                    }`}
            >
                {/* Brand */}
                <div className="flex items-center gap-2.5 px-4 h-14 border-b border-dark-700 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-primary-600/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/logo.svg" alt="xClaw" className="w-6 h-6" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-sm text-white leading-tight">xClaw</span>
                            <span className="text-[10px] text-slate-500 leading-tight">Admin Console</span>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-3 overflow-y-auto">
                    {NAV_SECTIONS.map(section => (
                        <div key={section.title} className="mb-4">
                            {!collapsed && (
                                <div className="px-4 mb-1.5 text-[10px] font-bold tracking-[0.15em] text-slate-600">
                                    {section.title}
                                </div>
                            )}
                            {collapsed && <div className="mx-3 mb-1.5 border-t border-dark-800" />}
                            <div className="px-2 space-y-0.5">
                                {section.items.map(item => {
                                    const active = currentView === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setView(item.id as any)}
                                            className={`group w-full flex items-center gap-2.5 rounded-lg text-[13px] transition-all duration-150 ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
                                                } ${active
                                                    ? 'bg-primary-600/15 text-primary-400 shadow-sm shadow-primary-600/5'
                                                    : 'text-slate-400 hover:bg-dark-800/70 hover:text-slate-200'
                                                }`}
                                            title={collapsed ? item.label : undefined}
                                        >
                                            <item.icon
                                                size={collapsed ? 20 : 16}
                                                className={`flex-shrink-0 transition-colors ${active ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'
                                                    }`}
                                            />
                                            {!collapsed && (
                                                <span className="font-medium truncate">{item.label}</span>
                                            )}
                                            {!collapsed && item.badge && (
                                                <span className="ml-auto text-[10px] bg-primary-600/20 text-primary-400 px-1.5 py-0.5 rounded-full">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Sidebar footer - Collapse + User */}
                <div className="border-t border-dark-700 flex-shrink-0">
                    {/* Collapse toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-dark-800/50 transition text-xs"
                    >
                        {collapsed ? <ChevronRight size={14} /> : (
                            <>
                                <ChevronLeft size={14} />
                                <span>Collapse</span>
                            </>
                        )}
                    </button>

                    {/* User card */}
                    <div className="px-3 py-3 border-t border-dark-800">
                        {collapsed ? (
                            <button
                                onClick={logout}
                                className="w-full flex justify-center"
                                title="Logout"
                            >
                                <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-300 text-xs font-bold hover:bg-amber-600/30 transition">
                                    {user.displayName[0].toUpperCase()}
                                </div>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-300 text-xs font-bold flex-shrink-0">
                                    {user.displayName[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-200 truncate">{user.displayName}</div>
                                    <div className="flex items-center gap-1">
                                        <Shield size={10} className="text-amber-400" />
                                        <span className="text-[10px] text-amber-400 font-medium">Admin</span>
                                    </div>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-dark-800 transition"
                                    title="Logout"
                                >
                                    <LogOut size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* ─── Main area ─── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top header bar */}
                <header className="h-14 flex items-center justify-between px-5 bg-dark-950/60 backdrop-blur border-b border-dark-700 flex-shrink-0">
                    {/* Left: Page title */}
                    <div>
                        <h1 className="text-sm font-semibold text-white leading-tight">{viewInfo.title}</h1>
                        <p className="text-[11px] text-slate-500 leading-tight">{viewInfo.subtitle}</p>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition">
                            <Search size={16} />
                        </button>
                        {/* Notifications */}
                        <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition">
                            <Bell size={16} />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary-400 rounded-full" />
                        </button>
                        {/* Separator */}
                        <div className="w-px h-6 bg-dark-700 mx-1" />
                        {/* User dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-800 transition"
                            >
                                <div className="w-7 h-7 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-300 text-xs font-bold">
                                    {user.displayName[0].toUpperCase()}
                                </div>
                                <span className="text-xs text-slate-300 hidden sm:block">{user.displayName}</span>
                                <ChevronDown size={12} className="text-slate-500" />
                            </button>
                            {userMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 py-1">
                                        <div className="px-3 py-2 border-b border-dark-700">
                                            <div className="text-xs font-medium text-white">{user.displayName}</div>
                                            <div className="text-[10px] text-amber-400">Administrator</div>
                                        </div>
                                        <button
                                            onClick={() => { setView('settings' as any); setUserMenuOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-dark-700 transition flex items-center gap-2"
                                        >
                                            <SettingsIcon size={12} /> Settings
                                        </button>
                                        <button
                                            onClick={logout}
                                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-dark-700 transition flex items-center gap-2"
                                        >
                                            <LogOut size={12} /> Sign out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {currentView === 'chat' && <ChatPanel />}
                    {currentView === 'agent-hub' && <AgentHub />}
                    {currentView === 'knowledge' && <KnowledgeBase />}
                    {currentView === 'api-keys' && <ApiKeyManager />}
                    {currentView === 'workflows' && <WorkflowCanvas />}
                    {currentView === 'skills' && <SkillsPanel />}
                    {currentView === 'resources' && <ResourcesDashboard />}
                    {currentView === 'health-dashboard' && <HealthDashboard />}
                    {currentView === 'users' && <UserManagement />}
                    {currentView === 'channels' && <ChannelManagement />}
                    {currentView === 'models' && <ModelManagement />}
                    {currentView === 'audit-log' && <AuditLog />}
                    {currentView === 'analytics' && <Analytics />}
                    {currentView === 'mcp-servers' && <MCPPanel />}
                    {currentView === 'doctor-profiles' && <DoctorProfiles />}
                    {currentView === 'learning-data' && <LearningDataReview />}
                    {currentView === 'data-quality' && <DataQualityOverview />}
                    {currentView === 'finetune-studio' && <FineTuningStudio />}
                    {currentView === 'chat-analysis' && <ChatAnalysis />}
                    {currentView === 'settings' && <Settings />}
                </main>
            </div>
        </div>
    );
}
