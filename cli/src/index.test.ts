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

vi.mock("./args", () => ({
    parseCliArgs: () => ({
        binaryVersion: undefined,
        noUpdateCheck: false,
        showCliVersion: false,
        showHelp: false,
        showBinaryVersionOnly: false,
        passThroughArgs: ["--foo", "bar"],
    }),
}));

vi.mock("./github", () => ({
    getLatestRelease: () =>
        Promise.resolve({
            version: "1.0.0",
            release: {
                tag_name: "v1.0.0",
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
            assets: [
                {
                    name: "kanban-ai-linux-x64",
                    browser_download_url: "https://example.com/bin",
                },
            ],
        }),
}));

vi.mock("./updates", () => ({
    decideVersionToUse: () =>
        Promise.resolve({ versionToUse: "1.0.0", fromCache: false }),
}));

vi.mock("./download", () => ({
    ensureBinaryDownloaded: () =>
        Promise.resolve("/tmp/kanbanai/1.0.0/linux/x64/kanban-ai-linux-x64"),
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
});
