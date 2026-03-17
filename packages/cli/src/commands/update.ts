// ============================================================
// CLI: xclaw update - Check for updates and show upgrade info
// ============================================================

import { Command } from 'commander';
import chalk from 'chalk';

export const updateCommand = new Command('update')
    .description('Check for new xClaw versions')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
        console.log('\nChecking for updates...\n');

        try {
            const res = await fetch('https://xclaw.xdev.asia/api/versions.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const info = await res.json() as {
                latest: string;
                minimum: string;
                releaseNotes: string;
                changelog: string;
                updateCommand: string;
                packages: Record<string, string>;
            };

            // Read current version from cli package
            const currentVersion = '0.2.0'; // synced at build time

            const cmp = (a: string, b: string) => {
                const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
                for (let i = 0; i < 3; i++) { if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1; if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1; }
                return 0;
            };

            const hasUpdate = cmp(currentVersion, info.latest) < 0;
            const isOutdated = cmp(currentVersion, info.minimum) < 0;

            if (opts.json) {
                console.log(JSON.stringify({ currentVersion, ...info, hasUpdate, isOutdated }, null, 2));
                return;
            }

            console.log(`  Current version: ${chalk.cyan('v' + currentVersion)}`);
            console.log(`  Latest version:  ${chalk.green('v' + info.latest)}`);
            console.log('');

            if (!hasUpdate) {
                console.log(chalk.green('  ✓ You are up to date!\n'));
                return;
            }

            if (isOutdated) {
                console.log(chalk.red.bold('  ⚠ Your version is below the minimum supported version.'));
                console.log(chalk.red('    Please update immediately.\n'));
            } else {
                console.log(chalk.yellow('  A new version is available!\n'));
            }

            if (info.releaseNotes) {
                console.log(`  ${chalk.dim('Release notes:')} ${info.releaseNotes}\n`);
            }

            console.log(`  ${chalk.dim('Update with:')}`);
            console.log(`  ${chalk.cyan(info.updateCommand)}\n`);

            if (info.changelog) {
                console.log(`  ${chalk.dim('Changelog:')} ${info.changelog}\n`);
            }

            // Show package versions
            if (info.packages) {
                console.log(chalk.dim('  Package versions:'));
                for (const [name, version] of Object.entries(info.packages)) {
                    console.log(`    ${name}: ${chalk.green(version)}`);
                }
                console.log('');
            }
        } catch (err) {
            console.error(chalk.red('  ✗ Cannot check for updates.'));
            console.error(chalk.dim(`    ${err instanceof Error ? err.message : String(err)}\n`));
            process.exit(1);
        }
    });
