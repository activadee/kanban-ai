import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestRelease, getReleaseByVersion } from "./github";

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

        const release = await getReleaseByVersion("owner/repo", "2.0.0");

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
});
