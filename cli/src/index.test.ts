import fs from "node:fs";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { execBinary, readCliPackageVersion, runCli } from "./index";

vi.mock("./env", () => ({
    resolveEnvOptions: () => ({
        githubRepo: "owner/repo",
        baseCacheDir: "/tmp/kanbanai",
        binaryVersionOverride: undefined,
        noUpdateCheck: false,
        assumeYes: false,
        assumeNo: false,
    }),
}));

vi.mock("./platform", () => ({
    detectPlatformArch: () => ({ platform: "linux", arch: "x64" }),
    resolveBinaryInfo: () => ({
        assetNameCandidates: ["kanban-ai-linux-x64"],
        cacheSubdirPlatform: "linux",
        cacheSubdirArch: "x64",
    }),
}));

const defaultCliOptions = {
    binaryVersion: undefined,
    noUpdateCheck: false,
    showCliVersion: false,
    showHelp: false,
    showBinaryVersionOnly: false,
    passThroughArgs: ["--foo", "bar"],
};

vi.mock("./args", () => ({
    parseCliArgs: vi.fn(() => ({ ...defaultCliOptions })),
}));

vi.mock("./github", () => {
    class GithubRateLimitError extends Error {
        status: number;
        retryAfterSeconds?: number;
        rateLimitResetSeconds?: number;

        constructor(
            message: string,
            options?: {
                status?: number;
                retryAfterSeconds?: number;
                rateLimitResetSeconds?: number;
            },
        ) {
            super(message);
            this.name = "GithubRateLimitError";
            this.status = options?.status ?? 403;
            this.retryAfterSeconds = options?.retryAfterSeconds;
            this.rateLimitResetSeconds = options?.rateLimitResetSeconds;
        }
    }

    return {
        GithubRateLimitError,
        getLatestRelease: () =>
            Promise.resolve({
                version: "1.0.0",
                release: {
                    tag_name: "v1.0.0",
                    body: "Test changelog body",
                    assets: [
                        {
                            name: "kanban-ai-linux-x64",
                            browser_download_url: "https://example.com/bin",
                        },
                    ],
                },
            }),
        getReleaseByVersion: () =>
            Promise.resolve({
                version: "1.0.0",
                release: {
                    tag_name: "v1.0.0",
                    body: "Test changelog body",
                    assets: [
                        {
                            name: "kanban-ai-linux-x64",
                            browser_download_url: "https://example.com/bin",
                        },
                    ],
                },
            }),
        resolveLatestReleaseAssetViaRedirect: (
            repo: string,
            assetNameCandidates: string[],
        ) => {
            const assetName = assetNameCandidates[0] ?? "kanban-ai-linux-x64";
            return Promise.resolve({
                tag: "v1.0.0",
                version: "1.0.0",
                assetName,
                url: `https://github.com/${repo}/releases/download/v1.0.0/${assetName}`,
            });
        },
        resolveReleaseAssetViaRedirect: (
            repo: string,
            version: string,
            assetNameCandidates: string[],
        ) => {
            const tag = version.startsWith("v") ? version : `v${version}`;
            const assetName = assetNameCandidates[0] ?? "kanban-ai-linux-x64";
            return Promise.resolve({
                tag,
                version: tag.replace(/^v/, ""),
                assetName,
                url: `https://github.com/${repo}/releases/download/${tag}/${assetName}`,
            });
        },
    };
});

vi.mock("./updates", () => ({
    decideVersionToUse: vi.fn(async (opts: any) => {
        if (opts && typeof opts.onNewVersionAvailable === "function") {
            await opts.onNewVersionAvailable({
                latestRemoteVersion: opts.latestRemoteVersion ?? "1.0.0",
                latestCachedVersion: "0.9.0",
            });
        }

        return { versionToUse: "1.0.0", fromCache: false };
    }),
}));

const ensureBinaryDownloadedMock = vi.fn<
    (opts: { baseCacheDir: string; version: string }) => Promise<string>
>(() => Promise.resolve("/tmp/kanbanai/1.0.0/linux/x64/kanban-ai-linux-x64"));

vi.mock("./download", () => ({
    ensureBinaryDownloaded: (opts: { baseCacheDir: string; version: string }) =>
        ensureBinaryDownloadedMock(opts),
}));

vi.mock("./help", () => ({
    printHelp: vi.fn(),
}));

vi.mock("node:child_process", () => {
    const spawn = vi.fn((command: string) => {
        const emitter = new EventEmitter();
        // Simulate different behaviours based on the "binary" path.
        if (command.includes("fail")) {
            setImmediate(() => {
                emitter.emit("error", new Error("spawn failed"));
            });
        } else if (command.includes("signal")) {
            setImmediate(() => {
                emitter.emit("exit", null, "SIGTERM");
            });
        } else {
            setImmediate(() => {
                emitter.emit("exit", 0, null);
            });
        }
        return emitter as any;
    });
    return { spawn };
});

describe("index helpers", () => {
    it("reads CLI package version from package.json", () => {
        const version = readCliPackageVersion();
        expect(typeof version).toBe("string");
        expect(version.length).toBeGreaterThan(0);
    });

    it("spawns binary and exits with its code", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await execBinary("/path/to/binary", ["--foo", "bar"], "1.2.3");
            expect(exitSpy).toHaveBeenCalledWith(0);
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
        }
    });

    it("logs and rejects when spawn fails", async () => {
        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        await expect(execBinary("/path/to/fail", [], "1.2.3")).rejects.toThrow(
            "spawn failed",
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("Failed to start KanbanAI binary"),
        );

        consoleSpy.mockRestore();
    });

    it("forwards signal when child exits with a signal", async () => {
        const killSpy = vi
            .spyOn(process, "kill")
            .mockImplementation(() => true as any);

        await execBinary("/path/to/signal", [], "1.2.3");

        expect(killSpy).toHaveBeenCalledWith(process.pid, "SIGTERM");
        killSpy.mockRestore();
    });

    it("returns a default version when package.json cannot be read", () => {
        const spy = vi.spyOn(fs, "readFileSync").mockImplementation(() => {
            throw new Error("boom");
        });

        const version = readCliPackageVersion();
        expect(version).toBe("0.0.0");

        spy.mockRestore();
    });
});

describe("runCli", () => {
    it("runs end-to-end with mocked dependencies", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await runCli();

            // runCli should eventually exit with the child code.
            expect(exitSpy).toHaveBeenCalled();
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
        }
    });

    it("prints changelog when a newer version is detected", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await runCli();

            expect(
                logSpy.mock.calls.some((call) =>
                    String(call[0]).includes("Changelog (from GitHub release notes):"),
                ),
            ).toBe(true);
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            logSpy.mockRestore();
        }
    });

    it("prints a fallback message when no changelog is available", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const githubModule = await import("./github");
        const getLatestReleaseSpy = vi
            .spyOn(githubModule, "getLatestRelease")
            .mockResolvedValueOnce({
                version: "1.0.0",
                release: {
                    tag_name: "v1.0.0",
                    body: "",
                    assets: [
                        {
                            name: "kanban-ai-linux-x64",
                            browser_download_url: "https://example.com/bin",
                        },
                    ],
                },
            } as any);

        const updatesModule = await import("./updates");
        const decideMock =
            updatesModule.decideVersionToUse as unknown as ReturnType<
                typeof vi.fn
            >;
        (decideMock as any).mockImplementationOnce(async (opts: any) => {
            if (opts && typeof opts.onNewVersionAvailable === "function") {
                await opts.onNewVersionAvailable({
                    latestRemoteVersion: opts.latestRemoteVersion ?? "1.0.0",
                    latestCachedVersion: undefined as any,
                });
            }

            return { versionToUse: "1.0.0", fromCache: false };
        });

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await runCli();

            expect(
                logSpy.mock.calls.some((call) =>
                    String(call[0]).includes(
                        "No changelog was provided for this release.",
                    ),
                ),
            ).toBe(true);
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            logSpy.mockRestore();
            getLatestReleaseSpy.mockRestore();
        }
    });

    it("uses cached version path when decideVersionToUse returns fromCache=true", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const updatesModule = await import("./updates");
        const decideMock =
            updatesModule.decideVersionToUse as unknown as ReturnType<
                typeof vi.fn
            >;
        (decideMock as any).mockReturnValueOnce(
            Promise.resolve({ versionToUse: "1.0.0", fromCache: true }),
        );

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await runCli();
            expect(exitSpy).toHaveBeenCalled();
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
        }
    });

    it("fetches a non-latest release when decideVersionToUse picks an older version", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const updatesModule = await import("./updates");
        const decideMock =
            updatesModule.decideVersionToUse as unknown as ReturnType<
                typeof vi.fn
            >;
        (decideMock as any).mockReturnValueOnce(
            Promise.resolve({ versionToUse: "0.9.0", fromCache: false }),
        );

        const githubModule = await import("./github");
        const getReleaseByVersionSpy = vi.spyOn(
            githubModule,
            "getReleaseByVersion",
        );

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await runCli();
            expect(getReleaseByVersionSpy).toHaveBeenCalledWith(
                "owner/repo",
                "0.9.0",
                expect.objectContaining({
                    cache: expect.any(Object),
                }),
            );
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            getReleaseByVersionSpy.mockRestore();
        }
    });

    it("throws when release lookup fails and no cached versions exist", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const updatesModule = await import("./updates");
        const decideMock =
            updatesModule.decideVersionToUse as unknown as ReturnType<typeof vi.fn>;
        (decideMock as any).mockReturnValueOnce(
            Promise.resolve({ versionToUse: "0.9.0", fromCache: false }),
        );

        const githubModule = await import("./github");
        const getReleaseByVersionSpy = vi
            .spyOn(githubModule, "getReleaseByVersion")
            .mockRejectedValueOnce(new Error("boom"));

        const cacheModule = await import("./cache");
        const getCachedVersionsSpy = vi
            .spyOn(cacheModule, "getCachedVersionsForPlatform")
            .mockReturnValueOnce([]);

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await expect(runCli()).rejects.toThrow("boom");
            expect(getReleaseByVersionSpy).toHaveBeenCalled();
            expect(getCachedVersionsSpy).toHaveBeenCalled();
            expect(exitSpy).not.toHaveBeenCalled();
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            getReleaseByVersionSpy.mockRestore();
            getCachedVersionsSpy.mockRestore();
        }
    });

    it("falls back to cached version when update check fails", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const githubModule = await import("./github");
        const getLatestReleaseSpy = vi
            .spyOn(githubModule, "getLatestRelease")
            .mockRejectedValueOnce(new Error("offline"));

        const cacheModule = await import("./cache");
        const getCachedVersionsSpy = vi
            .spyOn(cacheModule, "getCachedVersionsForPlatform")
            .mockReturnValueOnce(["1.0.0"]);

        const getBinaryPathSpy = vi
            .spyOn(cacheModule, "getBinaryPath")
            .mockReturnValueOnce(
                "/tmp/kanbanai/1.0.0/linux/x64/kanban-ai-linux-x64",
            );

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            await runCli();
            expect(getLatestReleaseSpy).toHaveBeenCalled();
            expect(getCachedVersionsSpy).toHaveBeenCalled();
            expect(getBinaryPathSpy).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalled();
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            getLatestReleaseSpy.mockRestore();
            getCachedVersionsSpy.mockRestore();
            getBinaryPathSpy.mockRestore();
        }
    });

    it("prints binary version only when requested", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const argsModule = await import("./args");
        const parseCliArgsMock =
            argsModule.parseCliArgs as unknown as ReturnType<typeof vi.fn>;
        (parseCliArgsMock as any).mockReturnValueOnce({
            ...defaultCliOptions,
            showBinaryVersionOnly: true,
        });

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            ensureBinaryDownloadedMock.mockClear();
            await runCli();
            expect(logSpy).toHaveBeenCalledWith("1.0.0");
            expect(exitSpy).toHaveBeenCalledWith(0);
            expect(ensureBinaryDownloadedMock).not.toHaveBeenCalled();
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            logSpy.mockRestore();
            ensureBinaryDownloadedMock.mockClear();
        }
    });

    it("falls back to redirect when update check is rate-limited and no binaries are cached", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const githubModule = await import("./github");
        const getLatestReleaseSpy = vi
            .spyOn(githubModule, "getLatestRelease")
            .mockRejectedValueOnce(
                new githubModule.GithubRateLimitError("rate limited", { status: 403 }),
            );

        const redirectSpy = vi.spyOn(
            githubModule,
            "resolveLatestReleaseAssetViaRedirect",
        );

        const cacheModule = await import("./cache");
        const getCachedVersionsSpy = vi
            .spyOn(cacheModule, "getCachedVersionsForPlatform")
            .mockReturnValueOnce([]);

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            ensureBinaryDownloadedMock.mockClear();
            await runCli();

            expect(getLatestReleaseSpy).toHaveBeenCalled();
            expect(getCachedVersionsSpy).toHaveBeenCalled();
            expect(redirectSpy).toHaveBeenCalled();
            expect(ensureBinaryDownloadedMock).toHaveBeenCalledWith(
                expect.objectContaining({ version: "1.0.0" }),
            );
            expect(exitSpy).toHaveBeenCalled();
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            getLatestReleaseSpy.mockRestore();
            redirectSpy.mockRestore();
            getCachedVersionsSpy.mockRestore();
            errorSpy.mockRestore();
            ensureBinaryDownloadedMock.mockClear();
        }
    });

    it("falls back to redirect download when pinned release lookup is rate-limited", async () => {
        const exitSpy = vi.fn();
        const originalExit = process.exit as unknown;

        const argsModule = await import("./args");
        const parseCliArgsMock =
            argsModule.parseCliArgs as unknown as ReturnType<typeof vi.fn>;
        (parseCliArgsMock as any).mockReturnValueOnce({
            ...defaultCliOptions,
            binaryVersion: "v1.2.3",
        });

        const githubModule = await import("./github");
        const getReleaseByVersionSpy = vi
            .spyOn(githubModule, "getReleaseByVersion")
            .mockRejectedValueOnce(
                new githubModule.GithubRateLimitError("rate limited", { status: 403 }),
            );

        const redirectSpy = vi.spyOn(
            githubModule,
            "resolveReleaseAssetViaRedirect",
        );

        const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValueOnce(false);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        // @ts-expect-error override for tests
        process.exit = exitSpy;

        try {
            ensureBinaryDownloadedMock.mockClear();
            await runCli();

            expect(getReleaseByVersionSpy).toHaveBeenCalled();
            expect(redirectSpy).toHaveBeenCalledWith(
                "owner/repo",
                "1.2.3",
                expect.any(Array),
            );
            expect(ensureBinaryDownloadedMock).toHaveBeenCalledWith(
                expect.objectContaining({ version: "1.2.3" }),
            );
            expect(exitSpy).toHaveBeenCalled();
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            getReleaseByVersionSpy.mockRestore();
            redirectSpy.mockRestore();
            existsSpy.mockRestore();
            errorSpy.mockRestore();
            ensureBinaryDownloadedMock.mockClear();
        }
    });
});
