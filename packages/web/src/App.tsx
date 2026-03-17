// ============================================================
// App - Route to Admin or User layout based on role
// ============================================================

import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { LoginPage } from '@/components/auth/LoginPage';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { UserLayout } from '@/components/layouts/UserLayout';


function App() {
    const user = useAuthStore(s => s.user);
    const authLoading = useAuthStore(s => s.isLoading);
    const restoreSession = useAuthStore(s => s.restoreSession);

    useEffect(() => {
        restoreSession();
    }, []);

    // Show loading while restoring session
    if (authLoading && !user) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-dark-950">
                <img src="/logo.svg" alt="xClaw" className="w-10 h-10 animate-pulse" />
            </div>
        );
    }

    // Show login if not authenticated
    if (!user) {
        return <LoginPage />;
    }

    // Route to the appropriate layout
    return user.role === 'admin' ? <AdminLayout /> : <UserLayout />;
}

export default App;
