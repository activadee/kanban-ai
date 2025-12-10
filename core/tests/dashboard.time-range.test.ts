import { describe, expect, it } from "vitest";

import { DEFAULT_DASHBOARD_TIME_RANGE_PRESET, type DashboardTimeRange } from "shared";
import { resolveTimeRange } from "../src/dashboard/time-range";

describe("dashboard/time-range", () => {
    const fixedNow = new Date("2025-01-02T12:00:00Z");

    const msInDay = 24 * 60 * 60 * 1000;

    function assertWindow(
        range: DashboardTimeRange,
        expectedStartOffsetDays: number,
        expectedPreset: DashboardTimeRange["preset"],
    ) {
        expect(range.preset).toBe(expectedPreset);
        expect(range.from).toBeDefined();
        expect(range.to).toBeDefined();

        const from = new Date(range.from!);
        const to = new Date(range.to!);

        expect(to.toISOString()).toBe(fixedNow.toISOString());
        const diffMs = to.getTime() - from.getTime();
        expect(diffMs).toBe(expectedStartOffsetDays * msInDay);
    }

    it("uses the shared default preset when no input is provided", () => {
        const range = resolveTimeRange(undefined, fixedNow);
        const expectedDays =
            DEFAULT_DASHBOARD_TIME_RANGE_PRESET === "last_24h"
                ? 1
                : DEFAULT_DASHBOARD_TIME_RANGE_PRESET === "last_7d"
                    ? 7
                    : DEFAULT_DASHBOARD_TIME_RANGE_PRESET === "last_30d"
                        ? 30
                        : 90;
        assertWindow(range, expectedDays, DEFAULT_DASHBOARD_TIME_RANGE_PRESET);
    });

    it("resolves last_7d preset to a 7 day window", () => {
        const range = resolveTimeRange({ preset: "last_7d" }, fixedNow);
        assertWindow(range, 7, "last_7d");
    });

    it("resolves last_30d preset to a 30 day window", () => {
        const range = resolveTimeRange({ preset: "last_30d" }, fixedNow);
        assertWindow(range, 30, "last_30d");
    });

    it("resolves last_90d preset to a 90 day window", () => {
        const range = resolveTimeRange({ preset: "last_90d" }, fixedNow);
        assertWindow(range, 90, "last_90d");
    });

    it("treats all_time as unbounded on the lower side", () => {
        const range = resolveTimeRange({ preset: "all_time" }, fixedNow);
        expect(range.preset).toBe("all_time");
        expect(range.from).toBeUndefined();
        expect(range.to).toBe(fixedNow.toISOString());
    });

    it("prefers custom from/to when both are valid ISO strings", () => {
        const from = "2025-01-01T00:00:00Z";
        const to = "2025-01-02T00:00:00Z";
        const range = resolveTimeRange({ from, to }, fixedNow);
        expect(range.from).toBe(from);
        expect(range.to).toBe(to);
    });

    it("falls back to the default preset when custom from/to are invalid or incomplete", () => {
        const invalid: DashboardTimeRange = { from: "not-a-date" as any, to: undefined };
        const range = resolveTimeRange(invalid, fixedNow);
        // Default preset is the shared constant when none is provided.
        expect(range.preset).toBe(DEFAULT_DASHBOARD_TIME_RANGE_PRESET);
        expect(range.from).toBeDefined();
        expect(range.to).toBeDefined();
    });
});
