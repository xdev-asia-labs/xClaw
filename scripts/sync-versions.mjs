#!/usr/bin/env node

/**
 * Sync root version to all public packages and update internal @xclaw/* dependency references.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const newVersion = rootPkg.version;

const publicPackages = [
    'packages/shared',
    'packages/core',
    'packages/skills',
    'packages/gateway',
    'packages/cli',
];

console.log(`Syncing all packages to version ${newVersion}`);

for (const dir of publicPackages) {
    const pkgPath = resolve(root, dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    pkg.version = newVersion;

    // Update @xclaw/* dependency versions
    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (!pkg[depType]) continue;
        for (const [name, ver] of Object.entries(pkg[depType])) {
            if (name.startsWith('@xclaw/') && ver !== '*') {
                pkg[depType][name] = `^${newVersion}`;
            }
        }
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
    console.log(`  ✓ ${pkg.name} → ${newVersion}`);
}

// ─── Update docs/public/api/versions.json ───────────────────
const versionsPath = resolve(root, 'docs/public/api/versions.json');
try {
    const versions = JSON.parse(readFileSync(versionsPath, 'utf8'));
    versions.latest = newVersion;
    versions.releaseDate = new Date().toISOString();
    // Update all package versions
    for (const dir of publicPackages) {
        const pkg = JSON.parse(readFileSync(resolve(root, dir, 'package.json'), 'utf8'));
        versions.packages[pkg.name] = newVersion;
    }
    versions.updateCommand = `npm update ${publicPackages.map(d => {
        const p = JSON.parse(readFileSync(resolve(root, d, 'package.json'), 'utf8'));
        return p.name;
    }).join(' ')}`;
    writeFileSync(versionsPath, JSON.stringify(versions, null, 4) + '\n');
    console.log(`  ✓ docs/public/api/versions.json → ${newVersion}`);
} catch { console.log('  ⚠ docs/public/api/versions.json not found, skipping'); }

// ─── Update docs/public/api/agent-registry.json version ─────
const registryPath = resolve(root, 'docs/public/api/agent-registry.json');
try {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    registry.version = newVersion;
    registry.updatedAt = new Date().toISOString();
    for (const agent of registry.agents) {
        agent.version = newVersion;
    }
    writeFileSync(registryPath, JSON.stringify(registry, null, 4) + '\n');
    console.log(`  ✓ docs/public/api/agent-registry.json → ${newVersion}`);
} catch { console.log('  ⚠ docs/public/api/agent-registry.json not found, skipping'); }

console.log('Done!');
