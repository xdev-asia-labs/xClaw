// ============================================================
// UserManagement - Admin user list + role management
// ============================================================

import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { useAuthStore } from '@/stores/auth-store';
import { Users, Shield, ShieldOff, UserCheck, UserX, Loader2, RefreshCw } from 'lucide-react';

interface UserRow {
    id: string;
    username: string;
    displayName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string | null;
}

export function UserManagement() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const currentUser = useAuthStore(s => s.user);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.admin.getUsers();
            setUsers(res.users);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const toggleRole = async (user: UserRow) => {
        if (user.id === currentUser?.id) return;
        setActionLoading(user.id);
        try {
            const newRole = user.role === 'admin' ? 'user' : 'admin';
            await api.admin.setUserRole(user.id, newRole);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
        } catch { }
        setActionLoading(null);
    };

    const toggleActive = async (user: UserRow) => {
        if (user.id === currentUser?.id) return;
        setActionLoading(user.id);
        try {
            await api.admin.setUserActive(user.id, !user.isActive);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
        } catch { }
        setActionLoading(null);
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Users size={24} className="text-slate-400" />
                        <h1 className="text-2xl font-bold text-white">User Management</h1>
                    </div>
                    <button onClick={load} className="p-2 hover:bg-dark-800 rounded-lg text-slate-400" title="Refresh">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-slate-500" />
                    </div>
                ) : (
                    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-dark-700">
                                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">User</th>
                                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Role</th>
                                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
                                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Last Login</th>
                                    <th className="text-right text-xs font-medium text-slate-400 px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className="border-b border-dark-700/50 hover:bg-dark-750">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-600/30 flex items-center justify-center text-primary-300 text-xs font-bold">
                                                    {user.displayName[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{user.displayName}</div>
                                                    <div className="text-xs text-slate-500">@{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600/30 text-slate-400'
                                                }`}>
                                                {user.role === 'admin' ? <Shield size={12} /> : null}
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs ${user.isActive ? 'text-green-400' : 'text-red-400'}`}>
                                                {user.isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {user.id !== currentUser?.id && (
                                                <div className="flex items-center justify-end gap-2">
                                                    {actionLoading === user.id ? (
                                                        <Loader2 size={14} className="animate-spin text-slate-500" />
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => toggleRole(user)}
                                                                className="p-1.5 hover:bg-dark-700 rounded text-slate-400 hover:text-amber-400 transition"
                                                                title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                                                            >
                                                                {user.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}
                                                            </button>
                                                            <button
                                                                onClick={() => toggleActive(user)}
                                                                className="p-1.5 hover:bg-dark-700 rounded text-slate-400 hover:text-red-400 transition"
                                                                title={user.isActive ? 'Disable' : 'Enable'}
                                                            >
                                                                {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.length === 0 && (
                            <div className="text-center py-8 text-slate-500 text-sm">No users found</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
