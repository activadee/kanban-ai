#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { resolveEnvOptions } from "./env";
import { detectPlatformArch, resolveBinaryInfo } from "./platform";
import { parseCliArgs } from "./args";
import {
    getLatestRelease,
    getReleaseByVersion,
    GithubRateLimitError,
    resolveLatestReleaseAssetViaRedirect,
    resolveReleaseAssetViaRedirect,
    type GithubRelease,
} from "./github";
import { decideVersionToUse } from "./updates";
import { ensureBinaryDownloaded } from "./download";
import { getBinaryPath, getCachedVersionsForPlatform } from "./cache";
import { printHelp } from "./help";
import { cleanVersionTag } from "./version";

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

    const githubApiCache = {
        dir: path.join(effectiveEnv.configDir, "github-api"),
    };

    const explicitVersion = cliOptions.binaryVersion
        ? cleanVersionTag(cliOptions.binaryVersion)
        : undefined;
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
            try {
                const resolved = await getReleaseByVersion(
                    effectiveEnv.githubRepo,
                    explicitVersion,
                    { cache: githubApiCache },
                );

                if (resolved.meta?.warning) {
                    process.stderr.write(`${resolved.meta.warning}\n`);
                }

                targetVersion = resolved.version;
                release = resolved.release;
            } catch (err) {
                if (err instanceof GithubRateLimitError) {
                    // eslint-disable-next-line no-console
                    console.error(err.message);
                    const fallback = await resolveReleaseAssetViaRedirect(
                        effectiveEnv.githubRepo,
                        explicitVersion,
                        binaryInfo.assetNameCandidates,
                    );
                    release = {
                        tag_name: fallback.tag,
                        assets: [
                            {
                                name: fallback.assetName,
                                browser_download_url: fallback.url,
                            },
                        ],
                    };
                } else {
                    throw err;
                }
            }
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
            try {
                const latest = await getLatestRelease(
                    effectiveEnv.githubRepo,
                    { cache: githubApiCache },
                );

                if (latest.meta?.warning) {
                    // eslint-disable-next-line no-console
                    console.error(latest.meta.warning);
                }

                targetVersion = latest.version;
                release = latest.release;
            } catch (err) {
                if (err instanceof GithubRateLimitError) {
                    // eslint-disable-next-line no-console
                    console.error(err.message);
                    const fallback = await resolveLatestReleaseAssetViaRedirect(
                        effectiveEnv.githubRepo,
                        binaryInfo.assetNameCandidates,
                    );
                    targetVersion = fallback.version;
                    release = {
                        tag_name: fallback.tag,
                        assets: [
                            {
                                name: fallback.assetName,
                                browser_download_url: fallback.url,
                            },
                        ],
                    };
                } else {
                    throw err;
                }
            }
        }
    } else {
        // Default behavior: consult GitHub to pick the appropriate version, then use cache or download.
        try {
            const { version: latestRemoteVersion, release: latestRelease, meta } =
                await getLatestRelease(effectiveEnv.githubRepo, { cache: githubApiCache });

            if (meta?.warning) {
                // eslint-disable-next-line no-console
                console.error(meta.warning);
            }
            const decision = await decideVersionToUse({
                env: effectiveEnv,
                platformArch,
                binaryInfo,
                latestRemoteVersion,
                explicitVersion: undefined,
                onNewVersionAvailable: ({ latestRemoteVersion: newVersion, latestCachedVersion }) => {
                    printReleaseChangelog({
                        release: latestRelease,
                        latestVersion: newVersion,
                        currentVersion: latestCachedVersion,
                    });
                },
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
                try {
                    const resolved = await getReleaseByVersion(
                        effectiveEnv.githubRepo,
                        targetVersion,
                        { cache: githubApiCache },
                    );

                    if (resolved.meta?.warning) {
                        process.stderr.write(`${resolved.meta.warning}\n`);
                    }

                    targetVersion = resolved.version;
                    release = resolved.release;
                } catch (err) {
                    if (err instanceof GithubRateLimitError) {
                        // eslint-disable-next-line no-console
                        console.error(err.message);
                        const fallback = await resolveReleaseAssetViaRedirect(
                            effectiveEnv.githubRepo,
                            targetVersion,
                            binaryInfo.assetNameCandidates,
                        );
                        release = {
                            tag_name: fallback.tag,
                            assets: [
                                {
                                    name: fallback.assetName,
                                    browser_download_url: fallback.url,
                                },
                            ],
                        };
                    } else {
                        throw err;
                    }
                }
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
            } else if (err instanceof GithubRateLimitError) {
                // eslint-disable-next-line no-console
                console.error(err.message);
                const fallback = await resolveLatestReleaseAssetViaRedirect(
                    effectiveEnv.githubRepo,
                    binaryInfo.assetNameCandidates,
                );
                targetVersion = fallback.version;
                release = {
                    tag_name: fallback.tag,
                    assets: [
                        {
                            name: fallback.assetName,
                            browser_download_url: fallback.url,
                        },
                    ],
                };
            } else {
                throw err;
            }
        }
    }

    if (cliOptions.showBinaryVersionOnly) {
        // eslint-disable-next-line no-console
        console.log(targetVersion);
        process.exit(0);
        return;
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

    await execBinary(binaryPath, cliOptions.passThroughArgs, targetVersion);
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

export function execBinary(binaryPath: string, args: string[], version?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(binaryPath, args, {
            stdio: "inherit",
            env: {
                ...process.env,
                // Expose the binary version to the server so version checks don’t fall back to 0.0.0-dev when packaged.
                KANBANAI_VERSION: version ?? process.env.KANBANAI_VERSION,
            },
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

function printReleaseChangelog(options: {
    release: GithubRelease;
    latestVersion: string;
    currentVersion?: string;
}): void {
    const { release, latestVersion, currentVersion } = options;
    const body = (release.body ?? "").trim();

    // eslint-disable-next-line no-console
    console.log("");

    if (currentVersion) {
        // eslint-disable-next-line no-console
        console.log(
            `A new KanbanAI version is available (${latestVersion}, you have ${currentVersion}).`,
        );
    } else {
        // eslint-disable-next-line no-console
        console.log(`A new KanbanAI version is available (${latestVersion}).`);
    }

    if (body) {
        // eslint-disable-next-line no-console
        console.log("");
        // eslint-disable-next-line no-console
        console.log("Changelog (from GitHub release notes):");
        // eslint-disable-next-line no-console
        console.log(body);
    } else {
        // eslint-disable-next-line no-console
        console.log("");
        // eslint-disable-next-line no-console
        console.log("No changelog was provided for this release.");
    }

    // eslint-disable-next-line no-console
    console.log("");
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
