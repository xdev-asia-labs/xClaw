// ============================================================
// Version Checker - Check for new xClaw versions from registry
// Fetches version info from docs API (xclaw.xdev.asia)
// ============================================================

const VERSIONS_URL = 'https://xclaw.xdev.asia/api/versions.json';
const REGISTRY_URL = 'https://xclaw.xdev.asia/api/agent-registry.json';

export interface VersionInfo {
    latest: string;
    minimum: string;
    releaseDate: string;
    changelog: string;
    npm: string;
    packages: Record<string, string>;
    releaseNotes: string;
    updateCommand: string;
}

export interface VersionCheckResult {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    isOutdated: boolean; // below minimum
    releaseNotes: string;
    changelog: string;
    updateCommand: string;
}

export interface AgentRegistryEntry {
    id: string;
    name: string;
    package: string;
    description: string;
    longDescription: string;
    version: string;
    author: string;
    category: string;
    icon: string;
    color: string;
    tags: string[];
    toolCount: number;
    tools: { name: string; description: string }[];
    featured: boolean;
    isBuiltIn: boolean;
    minVersion: string;
}

export interface AgentRegistry {
    version: string;
    updatedAt: string;
    registry: string;
    homepage: string;
    agents: AgentRegistryEntry[];
}

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareSemver(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const va = pa[i] ?? 0;
        const vb = pb[i] ?? 0;
        if (va < vb) return -1;
        if (va > vb) return 1;
    }
    return 0;
}

/**
 * Check if a newer version of xClaw is available.
 */
export async function checkForUpdates(currentVersion: string): Promise<VersionCheckResult> {
    const res = await fetch(VERSIONS_URL);
    if (!res.ok) throw new Error(`Failed to fetch version info: ${res.status}`);
    const info = await res.json() as VersionInfo;

    return {
        currentVersion,
        latestVersion: info.latest,
        hasUpdate: compareSemver(currentVersion, info.latest) < 0,
        isOutdated: compareSemver(currentVersion, info.minimum) < 0,
        releaseNotes: info.releaseNotes,
        changelog: info.changelog,
        updateCommand: info.updateCommand,
    };
}

/**
 * Fetch the full agent registry from the docs API.
 */
export async function fetchAgentRegistry(): Promise<AgentRegistry> {
    const res = await fetch(REGISTRY_URL);
    if (!res.ok) throw new Error(`Failed to fetch agent registry: ${res.status}`);
    return res.json() as Promise<AgentRegistry>;
}

/**
 * Fetch agent registry with a custom URL (e.g. for self-hosted docs).
 */
export async function fetchAgentRegistryFrom(url: string): Promise<AgentRegistry> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch agent registry: ${res.status}`);
    return res.json() as Promise<AgentRegistry>;
}
