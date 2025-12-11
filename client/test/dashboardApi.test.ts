import {describe, it, expect, beforeEach, vi} from "vitest";

vi.mock("@/lib/env", () => ({
    SERVER_URL: "http://test-server/api/v1",
}));

vi.mock("@/api/http", () => ({
    parseApiResponse: vi.fn(async () => ({
        timeRange: {preset: "last_7d"},
        generatedAt: new Date().toISOString(),
        metrics: {byKey: {}},
        activeAttempts: [],
        recentAttemptActivity: [],
        inboxItems: {
            review: [],
            failed: [],
            stuck: [],
        },
        projectSnapshots: [],
        agentStats: [],
    })),
}));

import {getDashboardOverview} from "@/api/dashboard";

describe("api/dashboard.getDashboardOverview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-expect-error - assigning to global fetch in test environment
        global.fetch = vi.fn().mockResolvedValue(
            new Response("{}", {
                status: 200,
                headers: {"Content-Type": "application/json"},
            }),
        );
    });

    it("calls /dashboard without query parameters when no time range is provided", async () => {
        await getDashboardOverview();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith("http://test-server/api/v1/dashboard");
    });

    it("passes timeRangePreset as a query parameter when provided", async () => {
        await getDashboardOverview({timeRangePreset: "last_24h"});

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            "http://test-server/api/v1/dashboard?timeRangePreset=last_24h",
        );
    });

    it("passes from/to query parameters when a custom range is provided", async () => {
        const from = "2025-01-01T00:00:00.000Z";
        const to = "2025-01-02T00:00:00.000Z";

        await getDashboardOverview({from, to});

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            `http://test-server/api/v1/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
    });
});
