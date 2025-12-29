import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideVersionToUse } from "./updates";
import { EnvOptions } from "./env";
import { BinaryInfo, PlatformArch } from "./platform";

const platformArch: PlatformArch = {
    platform: "linux",
    arch: "x64",
};

const binaryInfo: BinaryInfo = {
    assetNameCandidates: ["kanban-ai-linux-x64"],
    cacheSubdirPlatform: "linux",
    cacheSubdirArch: "x64",
};

const baseEnv: EnvOptions = {
    githubRepo: "owner/repo",
    baseCacheDir: "/tmp/kanbanai",
    configDir: "/tmp/kanbanai-config",
    binaryVersionOverride: undefined,
    noUpdateCheck: false,
    assumeYes: false,
    assumeNo: false,
};

const questionMock =
    vi.fn<(question: string, cb: (answer: string) => void) => void>();

vi.mock("./cache", () => ({
    getCachedVersionsForPlatform: vi.fn(() => ["1.0.0"]),
}));

vi.mock("node:readline", () => ({
    default: {
        createInterface: () => ({
            question: (question: string, cb: (answer: string) => void) =>
                questionMock(question, cb),
            close: () => {},
        }),
    },
}));

beforeEach(() => {
    questionMock.mockReset();
});

describe("decideVersionToUse", () => {
    it("returns explicit version when provided", async () => {
        const decision = await decideVersionToUse({
            env: baseEnv,
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
            explicitVersion: "1.5.0",
        });

        expect(decision).toEqual({ versionToUse: "1.5.0", fromCache: false });
    });

    it("uses remote latest when no cached versions exist", async () => {
        const cacheModule = await import("./cache");
        const getCachedVersionsForPlatform =
            cacheModule.getCachedVersionsForPlatform as unknown as ReturnType<
                typeof vi.fn
            >;
        (getCachedVersionsForPlatform as any).mockReturnValueOnce([]);

        const decision = await decideVersionToUse({
            env: baseEnv,
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
        });

        expect(decision).toEqual({ versionToUse: "2.0.0", fromCache: false });
    });

    it("uses cached version when it is up to date", async () => {
        const cacheModule = await import("./cache");
        const getCachedVersionsForPlatform =
            cacheModule.getCachedVersionsForPlatform as unknown as ReturnType<
                typeof vi.fn
            >;
        (getCachedVersionsForPlatform as any).mockReturnValueOnce(["2.0.0"]);

        const decision = await decideVersionToUse({
            env: baseEnv,
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
        });

        expect(decision).toEqual({ versionToUse: "2.0.0", fromCache: true });
    });

    it("respects no-update-check by using cached version", async () => {
        const cacheModule = await import("./cache");
        const getCachedVersionsForPlatform =
            cacheModule.getCachedVersionsForPlatform as unknown as ReturnType<
                typeof vi.fn
            >;
        (getCachedVersionsForPlatform as any).mockReturnValueOnce(["1.0.0"]);

        const decision = await decideVersionToUse({
            env: { ...baseEnv, noUpdateCheck: true },
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
        });

        expect(decision).toEqual({ versionToUse: "1.0.0", fromCache: true });
    });

    it("prompts and uses remote latest when user accepts", async () => {
        const cacheModule = await import("./cache");
        const getCachedVersionsForPlatform =
            cacheModule.getCachedVersionsForPlatform as unknown as ReturnType<
                typeof vi.fn
            >;
        (getCachedVersionsForPlatform as any).mockReturnValueOnce(["1.0.0"]);

        const originalInTty = (process.stdin as any).isTTY;
        const originalOutTty = (process.stdout as any).isTTY;
        (process.stdin as any).isTTY = true;
        (process.stdout as any).isTTY = true;

        questionMock.mockImplementationOnce((_question, cb) => cb("y"));

        const decision = await decideVersionToUse({
            env: baseEnv,
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
        });

        (process.stdin as any).isTTY = originalInTty;
        (process.stdout as any).isTTY = originalOutTty;

        expect(decision).toEqual({ versionToUse: "2.0.0", fromCache: false });
    });

    it("prompts and uses cached version when user declines", async () => {
        const cacheModule = await import("./cache");
        const getCachedVersionsForPlatform =
            cacheModule.getCachedVersionsForPlatform as unknown as ReturnType<
                typeof vi.fn
            >;
        (getCachedVersionsForPlatform as any).mockReturnValueOnce(["1.0.0"]);

        const originalInTty = (process.stdin as any).isTTY;
        const originalOutTty = (process.stdout as any).isTTY;
        (process.stdin as any).isTTY = true;
        (process.stdout as any).isTTY = true;

        questionMock.mockImplementationOnce((_question, cb) => cb("n"));

        const decision = await decideVersionToUse({
            env: baseEnv,
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
        });

        (process.stdin as any).isTTY = originalInTty;
        (process.stdout as any).isTTY = originalOutTty;

        expect(decision).toEqual({ versionToUse: "1.0.0", fromCache: true });
    });

    it("invokes onNewVersionAvailable callback when a newer version is detected", async () => {
        const cacheModule = await import("./cache");
        const getCachedVersionsForPlatform =
            cacheModule.getCachedVersionsForPlatform as unknown as ReturnType<
                typeof vi.fn
            >;
        (getCachedVersionsForPlatform as any).mockReturnValueOnce(["1.0.0"]);

        const onNewVersionAvailable = vi.fn();

        await decideVersionToUse({
            env: baseEnv,
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
            onNewVersionAvailable,
        });

        expect(onNewVersionAvailable).toHaveBeenCalledWith({
            latestRemoteVersion: "2.0.0",
            latestCachedVersion: "1.0.0",
        });
    });

    it("does not invoke onNewVersionAvailable when cached version is up to date", async () => {
        const cacheModule = await import("./cache");
        const getCachedVersionsForPlatform =
            cacheModule.getCachedVersionsForPlatform as unknown as ReturnType<
                typeof vi.fn
            >;
        (getCachedVersionsForPlatform as any).mockReturnValueOnce(["2.0.0"]);

        const onNewVersionAvailable = vi.fn();

        const decision = await decideVersionToUse({
            env: baseEnv,
            platformArch,
            binaryInfo,
            latestRemoteVersion: "2.0.0",
            onNewVersionAvailable,
        });

        expect(decision).toEqual({ versionToUse: "2.0.0", fromCache: true });
        expect(onNewVersionAvailable).not.toHaveBeenCalled();
    });
});
