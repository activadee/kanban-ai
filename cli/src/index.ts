#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { resolveEnvOptions } from "./env";
import { detectPlatformArch, resolveBinaryInfo } from "./platform";
import { parseCliArgs } from "./args";
import { getLatestRelease, getReleaseByVersion } from "./github";
import { decideVersionToUse } from "./updates";
import { ensureBinaryDownloaded } from "./download";
import { getBinaryPath, getCachedVersionsForPlatform } from "./cache";
import { printHelp } from "./help";

export async function runCli(): Promise<void> {
    const env = resolveEnvOptions();
    const argv = process.argv.slice(2);

    const cliOptions = parseCliArgs(
        argv,
        env.binaryVersionOverride,
        env.noUpdateCheck,
    );

    const effectiveEnv = {
        ...env,
        noUpdateCheck: env.noUpdateCheck || cliOptions.noUpdateCheck,
    };

    if (cliOptions.showHelp) {
        printHelp();
        process.exit(0);
    }

    const pkgVersion = readCliPackageVersion();

    if (cliOptions.showCliVersion) {
        // eslint-disable-next-line no-console
        console.log(`kanban-ai CLI wrapper version ${pkgVersion}`);
        process.exit(0);
    }

    const platformArch = detectPlatformArch();
    const binaryInfo = resolveBinaryInfo(
        platformArch.platform,
        platformArch.arch,
    );

    const explicitVersion = cliOptions.binaryVersion;
    let targetVersion: string;
    let binaryPath: string | undefined;
    let release: any;

    if (explicitVersion) {
        // Pinned version: prefer cached binary and only hit GitHub if missing.
        const candidatePath = getBinaryPath(
            effectiveEnv.baseCacheDir,
            explicitVersion,
            platformArch,
            binaryInfo,
        );
        if (fs.existsSync(candidatePath)) {
            targetVersion = explicitVersion;
            binaryPath = candidatePath;
        } else {
            targetVersion = explicitVersion;
            release = await getReleaseByVersion(
                effectiveEnv.githubRepo,
                explicitVersion,
            );
        }
    } else if (effectiveEnv.noUpdateCheck || effectiveEnv.assumeNo) {
        // No-update mode: use latest cached version if available, without contacting GitHub.
        const cachedVersions = getCachedVersionsForPlatform(
            effectiveEnv.baseCacheDir,
            platformArch,
            binaryInfo,
        );
        if (cachedVersions.length > 0) {
            targetVersion = cachedVersions[0];
            binaryPath = getBinaryPath(
                effectiveEnv.baseCacheDir,
                targetVersion,
                platformArch,
                binaryInfo,
            );
        } else {
            // No cached versions yet: fall back to a one-time fetch of the latest release.
            const { version: latestRemoteVersion, release: latestRelease } =
                await getLatestRelease(effectiveEnv.githubRepo);
            targetVersion = latestRemoteVersion;
            release = latestRelease;
        }
    } else {
        // Default behavior: consult GitHub to pick the appropriate version, then use cache or download.
        try {
            const { version: latestRemoteVersion, release: latestRelease } =
                await getLatestRelease(effectiveEnv.githubRepo);
            const decision = await decideVersionToUse({
                env: effectiveEnv,
                platformArch,
                binaryInfo,
                latestRemoteVersion,
                explicitVersion: undefined,
            });
            targetVersion = decision.versionToUse;

            if (decision.fromCache && targetVersion !== latestRemoteVersion) {
                // eslint-disable-next-line no-console
                console.error(
                    `Using cached KanbanAI ${targetVersion}. A newer version ${latestRemoteVersion} is available on GitHub.`,
                );
            }

            if (decision.fromCache) {
                binaryPath = getBinaryPath(
                    effectiveEnv.baseCacheDir,
                    targetVersion,
                    platformArch,
                    binaryInfo,
                );
            } else if (targetVersion === latestRemoteVersion) {
                release = latestRelease;
            } else {
                release = await getReleaseByVersion(
                    effectiveEnv.githubRepo,
                    targetVersion,
                );
            }
        } catch (err) {
            const cachedVersions = getCachedVersionsForPlatform(
                effectiveEnv.baseCacheDir,
                platformArch,
                binaryInfo,
            );
            if (cachedVersions.length > 0) {
                targetVersion = cachedVersions[0];
                binaryPath = getBinaryPath(
                    effectiveEnv.baseCacheDir,
                    targetVersion,
                    platformArch,
                    binaryInfo,
                );
                // eslint-disable-next-line no-console
                console.error(
                    `Could not check for updates on GitHub (${(err as Error).message}). Using cached KanbanAI ${targetVersion}.`,
                );
            } else {
                throw err;
            }
        }
    }

    if (!binaryPath) {
        if (!release) {
            throw new Error("Unable to determine KanbanAI binary to execute.");
        }

        binaryPath = await ensureBinaryDownloaded({
            baseCacheDir: effectiveEnv.baseCacheDir,
            version: targetVersion,
            binaryInfo,
            release,
        });
    }

    if (cliOptions.showBinaryVersionOnly) {
        // eslint-disable-next-line no-console
        console.log(targetVersion);
        process.exit(0);
    }

    await execBinary(binaryPath, cliOptions.passThroughArgs);
}

export function readCliPackageVersion(): string {
    try {
        const pkgPath = path.join(__dirname, "..", "package.json");
        const raw = fs.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(raw) as { version?: string };
        return pkg.version ?? "0.0.0";
    } catch {
        return "0.0.0";
    }
}

export function execBinary(binaryPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(binaryPath, args, {
            stdio: "inherit",
        });

        child.on("error", (err) => {
            // eslint-disable-next-line no-console
            console.error(`Failed to start KanbanAI binary: ${err.message}`);
            reject(err);
        });

        child.on("exit", (code, signal) => {
            if (signal) {
                process.kill(process.pid, signal);
                resolve();
                return;
            }
            process.exit(code === null ? 1 : code);
            resolve();
        });
    });
}

/* c8 ignore start */
// Execute only when run directly (not when imported in tests).
if (require.main === module) {
    runCli().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
}
/* c8 ignore stop */
