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

vi.mock("./github", () => ({
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
            tag_name: "v1.0.0",
            body: "Test changelog body",
            assets: [
                {
                    name: "kanban-ai-linux-x64",
                    browser_download_url: "https://example.com/bin",
                },
            ],
        }),
}));

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
            await execBinary("/path/to/binary", ["--foo", "bar"]);
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

        await expect(execBinary("/path/to/fail", [])).rejects.toThrow(
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

        await execBinary("/path/to/signal", []);

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
            );
        } finally {
            // @ts-expect-error restore original
            process.exit = originalExit;
            getReleaseByVersionSpy.mockRestore();
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
});
