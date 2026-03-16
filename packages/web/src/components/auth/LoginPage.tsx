// ============================================================
// LoginPage - Authentication UI
// ============================================================

import React, { useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { Zap, LogIn, UserPlus, Loader2 } from 'lucide-react';

export function LoginPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const login = useAuthStore(s => s.login);
    const register = useAuthStore(s => s.register);
    const isLoading = useAuthStore(s => s.isLoading);
    const error = useAuthStore(s => s.error);
    const clearError = useAuthStore(s => s.clearError);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (mode === 'login') {
                await login(username, password);
            } else {
                await register(username, password, displayName || username);
            }
        } catch {
            // error is set in store
        }
    };

    const switchMode = () => {
        setMode(m => m === 'login' ? 'register' : 'login');
        clearError();
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-dark-950">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <Zap size={32} className="text-primary-400" />
                    <span className="text-3xl font-bold text-white tracking-tight">AutoX</span>
                </div>

                {/* Card */}
                <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white text-center mb-6">
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </h2>

                    {error && (
                        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 transition"
                                placeholder="Enter username"
                                required
                                minLength={3}
                                autoFocus
                            />
                        </div>

                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 transition"
                                    placeholder="Your display name"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 transition"
                                placeholder="Enter password"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition"
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : mode === 'login' ? (
                                <LogIn size={16} />
                            ) : (
                                <UserPlus size={16} />
                            )}
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <button
                            onClick={switchMode}
                            className="text-sm text-primary-400 hover:text-primary-300 transition"
                        >
                            {mode === 'login'
                                ? "Don't have an account? Register"
                                : 'Already have an account? Sign In'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
