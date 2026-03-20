// ============================================================
// @xclaw/chat-sdk/react — React Context & Provider
// ============================================================

import { createContext, useContext, useMemo, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { XClawClient } from '../client.js';
import type { XClawConfig } from '../types.js';

const XClawContext = createContext<XClawClient | null>(null);

export interface XClawProviderProps {
    config: XClawConfig;
    children: ReactNode;
}

/** Provider that makes XClawClient available to all child hooks */
export function XClawProvider({ config, children }: XClawProviderProps) {
    const clientRef = useRef<XClawClient | null>(null);

    const client = useMemo(() => {
        clientRef.current = new XClawClient(config);
        return clientRef.current;
    }, [config.baseUrl, config.token]);

    // Sync token changes without recreating client
    useEffect(() => {
        if (config.token && clientRef.current) {
            clientRef.current.setToken(config.token);
        }
    }, [config.token]);

    return (
        <XClawContext value={client}>
            {children}
        </XClawContext>
    );
}

/** Get the XClawClient from context */
export function useXClawClient(): XClawClient {
    const client = useContext(XClawContext);
    if (!client) {
        throw new Error('useXClawClient must be used within <XClawProvider>');
    }
    return client;
}
