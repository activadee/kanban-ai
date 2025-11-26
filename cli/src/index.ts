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
    let release;

    if (explicitVersion) {
        release = await getReleaseByVersion(
            effectiveEnv.githubRepo,
            explicitVersion,
        );
        targetVersion = explicitVersion;
    } else {
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

        if (targetVersion === latestRemoteVersion) {
            release = latestRelease;
        } else {
            release = await getReleaseByVersion(
                effectiveEnv.githubRepo,
                targetVersion,
            );
        }
    }

    const binaryPath = await ensureBinaryDownloaded({
        baseCacheDir: effectiveEnv.baseCacheDir,
        version: targetVersion,
        binaryInfo,
        release,
    });

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

// Execute only when run directly (not when imported in tests).
if (require.main === module) {
    runCli().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
}
