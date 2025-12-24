import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getLatestRelease,
    getReleaseByVersion,
    GithubRateLimitError,
    resolveLatestReleaseAssetViaRedirect,
    resolveReleaseAssetViaRedirect,
} from "./github";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
    process.env = { ...originalEnv };
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
});

describe("GitHub helpers", () => {
    it("fetches latest release and cleans version tag", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                tag_name: "v1.2.3",
                assets: [],
            }),
            text: async () => "",
        } as any);

        globalThis.fetch = fetchMock as any;

        const { version, release } = await getLatestRelease("owner/repo");

        expect(version).toBe("1.2.3");
        expect(release.tag_name).toBe("v1.2.3");
        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/repo/releases/latest",
            expect.any(Object),
        );
    });

    it("fetches release by specific version", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                tag_name: "v2.0.0",
                assets: [],
            }),
            text: async () => "",
        } as any);

        globalThis.fetch = fetchMock as any;

        const { version, release } = await getReleaseByVersion("owner/repo", "2.0.0");

        expect(version).toBe("2.0.0");
        expect(release.tag_name).toBe("v2.0.0");
        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.github.com/repos/owner/repo/releases/tags/v2.0.0",
            expect.any(Object),
        );
    });

    it("adds Authorization header when token is present", async () => {
        process.env.GITHUB_TOKEN = "secret";

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                tag_name: "v1.0.0",
                assets: [],
            }),
            text: async () => "",
        } as any);

        globalThis.fetch = fetchMock as any;

        await getLatestRelease("owner/repo");

        const [, options] = fetchMock.mock.calls[0];
        expect(options.headers.Authorization).toBe("Bearer secret");
    });

    it("throws a helpful error when GitHub API responds with an error", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: async () => ({}),
            text: async () => "missing",
        } as any);

        globalThis.fetch = fetchMock as any;

        await expect(getLatestRelease("owner/repo")).rejects.toThrow(
            /GitHub API request failed: 404 Not Found/,
        );
    });

    it("caches latest release responses on disk with TTL", async () => {
        const tmpDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "kanban-ai-cli-github-"),
        );

        try {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: "OK",
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "etag" ? "\"etag\"" : null,
                },
                json: async () => ({
                    tag_name: "v1.2.3",
                    assets: [],
                }),
                text: async () => "",
            } as any);

            globalThis.fetch = fetchMock as any;

            const first = await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 60_000, now: 1_000 },
            });
            const second = await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 60_000, now: 2_000 },
            });

            expect(first.version).toBe("1.2.3");
            expect(second.version).toBe("1.2.3");
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("uses If-None-Match and reuses cached body on 304", async () => {
        const tmpDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "kanban-ai-cli-github-"),
        );

        try {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: "OK",
                    headers: {
                        get: (name: string) =>
                            name.toLowerCase() === "etag" ? "\"etag\"" : null,
                    },
                    json: async () => ({
                        tag_name: "v1.2.3",
                        assets: [],
                    }),
                    text: async () => "",
                } as any)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 304,
                    statusText: "Not Modified",
                    headers: {
                        get: (name: string) =>
                            name.toLowerCase() === "etag" ? "\"etag\"" : null,
                    },
                    json: async () => ({}),
                    text: async () => "",
                } as any);

            globalThis.fetch = fetchMock as any;

            await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 1, now: 0 },
            });

            const second = await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 1, now: 10 },
            });

            expect(second.version).toBe("1.2.3");
            expect(fetchMock).toHaveBeenCalledTimes(2);

            const [, options] = fetchMock.mock.calls[1];
            expect(options.headers["If-None-Match"]).toBe("\"etag\"");
        } finally {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("respects ttlMs=0 for immediate revalidation", async () => {
        const tmpDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "kanban-ai-cli-github-"),
        );

        try {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: "OK",
                    headers: {
                        get: (name: string) =>
                            name.toLowerCase() === "etag" ? "\"etag\"" : null,
                    },
                    json: async () => ({
                        tag_name: "v1.2.3",
                        assets: [],
                    }),
                    text: async () => "",
                } as any)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 304,
                    statusText: "Not Modified",
                    headers: {
                        get: (name: string) =>
                            name.toLowerCase() === "etag" ? "\"etag\"" : null,
                    },
                    json: async () => ({}),
                    text: async () => "",
                } as any);

            globalThis.fetch = fetchMock as any;

            await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 0, now: 0 },
            });

            await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 0, now: 1 },
            });

            expect(fetchMock).toHaveBeenCalledTimes(2);
            const [, options] = fetchMock.mock.calls[1];
            expect(options.headers["If-None-Match"]).toBe("\"etag\"");
        } finally {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("writes cache entries even when rename fails", async () => {
        const tmpDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "kanban-ai-cli-github-"),
        );

        const renameSpy = vi
            .spyOn(fs.promises, "rename")
            .mockRejectedValue(new Error("rename failed") as any);

        try {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: "OK",
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "etag" ? "\"etag\"" : null,
                },
                json: async () => ({
                    tag_name: "v1.2.3",
                    assets: [],
                }),
                text: async () => "",
            } as any);

            globalThis.fetch = fetchMock as any;

            await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 60_000, now: 1_000 },
            });

            await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 60_000, now: 2_000 },
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            renameSpy.mockRestore();
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("returns cached data with a warning when rate-limited", async () => {
        const tmpDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "kanban-ai-cli-github-"),
        );

        try {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: "OK",
                    headers: {
                        get: (name: string) =>
                            name.toLowerCase() === "etag" ? "\"etag\"" : null,
                    },
                    json: async () => ({
                        tag_name: "v1.2.3",
                        assets: [],
                    }),
                    text: async () => "",
                } as any)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    statusText: "Forbidden",
                    headers: {
                        get: (name: string) => {
                            const key = name.toLowerCase();
                            if (key === "x-ratelimit-remaining") return "0";
                            if (key === "x-ratelimit-reset") return "9999999999";
                            return null;
                        },
                    },
                    json: async () => ({}),
                    text: async () => "API rate limit exceeded",
                } as any);

            globalThis.fetch = fetchMock as any;

            await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 1, now: 0 },
            });

            const second = await getLatestRelease("owner/repo", {
                cache: { dir: tmpDir, ttlMs: 1, now: 10 },
            });

            expect(second.version).toBe("1.2.3");
            expect(second.meta?.source).toBe("stale-cache");
            expect(second.meta?.warning).toMatch(/GITHUB_TOKEN|GH_TOKEN/);
        } finally {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("throws GithubRateLimitError when rate-limited without cache", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            headers: {
                get: (name: string) => {
                    const key = name.toLowerCase();
                    if (key === "x-ratelimit-remaining") return "0";
                    if (key === "x-ratelimit-reset") return "9999999999";
                    return null;
                },
            },
            json: async () => ({}),
            text: async () => "API rate limit exceeded",
        } as any);

        globalThis.fetch = fetchMock as any;

        await expect(getLatestRelease("owner/repo")).rejects.toBeInstanceOf(
            GithubRateLimitError,
        );
    });

    it("resolves latest release asset URL via redirect", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                status: 404,
                headers: { get: () => null },
            } as any)
            .mockResolvedValueOnce({
                status: 302,
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "location"
                            ? "https://github.com/owner/repo/releases/download/v9.9.9/asset"
                            : null,
                },
            } as any)
            .mockResolvedValueOnce({
                status: 302,
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "location"
                            ? "https://objects.githubusercontent.com/github-production-release-asset-2e65be/asset"
                            : null,
                },
            } as any);

        globalThis.fetch = fetchMock as any;

        const resolved = await resolveLatestReleaseAssetViaRedirect(
            "owner/repo",
            ["missing", "asset"],
        );

        expect(resolved.tag).toBe("v9.9.9");
        expect(resolved.version).toBe("9.9.9");
        expect(resolved.assetName).toBe("asset");
        expect(resolved.url).toBe(
            "https://objects.githubusercontent.com/github-production-release-asset-2e65be/asset",
        );
    });

    it("fails closed when latest redirect is missing a location", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                status: 302,
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "location"
                            ? "/owner/repo/releases/download/v9.9.9/asset"
                            : null,
                },
            } as any)
            .mockResolvedValueOnce({
                status: 302,
                headers: { get: () => null },
            } as any);

        globalThis.fetch = fetchMock as any;

        await expect(
            resolveLatestReleaseAssetViaRedirect("owner/repo", ["asset"]),
        ).rejects.toThrow(/Could not resolve latest release download URL/);
    });

    it("resolves a tagged release asset URL via redirect", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                status: 404,
                headers: { get: () => null },
            } as any)
            .mockResolvedValueOnce({
                status: 302,
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "location"
                            ? "https://objects.githubusercontent.com/github-production-release-asset-2e65be/asset"
                            : null,
                },
            } as any);

        globalThis.fetch = fetchMock as any;

        const resolved = await resolveReleaseAssetViaRedirect("owner/repo", "1.2.3", [
            "missing",
            "asset",
        ]);

        expect(resolved.tag).toBe("v1.2.3");
        expect(resolved.version).toBe("1.2.3");
        expect(resolved.assetName).toBe("asset");
        expect(resolved.url).toBe(
            "https://objects.githubusercontent.com/github-production-release-asset-2e65be/asset",
        );
    });

    it("returns the GitHub download URL when no redirect occurs", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce({
            status: 200,
            headers: { get: () => null },
        } as any);

        globalThis.fetch = fetchMock as any;

        const resolved = await resolveReleaseAssetViaRedirect(
            "owner/repo",
            "1.2.3",
            ["asset"],
        );

        expect(resolved.url).toBe(
            "https://github.com/owner/repo/releases/download/v1.2.3/asset",
        );
    });

    it("skips redirects without a location header", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                status: 302,
                headers: { get: () => null },
            } as any)
            .mockResolvedValueOnce({
                status: 302,
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "location"
                            ? "https://objects.githubusercontent.com/github-production-release-asset-2e65be/asset"
                            : null,
                },
            } as any);

        globalThis.fetch = fetchMock as any;

        const resolved = await resolveReleaseAssetViaRedirect(
            "owner/repo",
            "1.2.3",
            ["missing", "asset"],
        );

        expect(resolved.assetName).toBe("asset");
        expect(resolved.url).toBe(
            "https://objects.githubusercontent.com/github-production-release-asset-2e65be/asset",
        );
    });

    it("rejects unexpected redirect protocols", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce({
            status: 302,
            headers: {
                get: (name: string) =>
                    name.toLowerCase() === "location" ? "http://evil.test/asset" : null,
            },
        } as any);

        globalThis.fetch = fetchMock as any;

        await expect(
            resolveReleaseAssetViaRedirect("owner/repo", "1.2.3", ["asset"]),
        ).rejects.toThrow(/Unexpected redirect protocol/);
    });

    it("throws when tagged release asset cannot be resolved", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            status: 404,
            headers: { get: () => null },
        } as any);

        globalThis.fetch = fetchMock as any;

        await expect(
            resolveReleaseAssetViaRedirect("owner/repo", "1.2.3", ["asset"]),
        ).rejects.toThrow(/Could not resolve release download URL/);
    });
});
