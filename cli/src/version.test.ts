import { describe, expect, it } from "vitest";
import {
    cleanVersionTag,
    compareVersions,
    parseSemver,
    sortVersionsDescending,
} from "./version";

describe("version utilities", () => {
    it("cleans leading v from tags", () => {
        expect(cleanVersionTag("v1.2.3")).toBe("1.2.3");
        expect(cleanVersionTag("1.2.3")).toBe("1.2.3");
    });

    it("parses semver strings", () => {
        expect(parseSemver("1.2.3")).toEqual({
            major: 1,
            minor: 2,
            patch: 3,
            prerelease: [],
        });
        expect(parseSemver("v1.2.3")).toEqual({
            major: 1,
            minor: 2,
            patch: 3,
            prerelease: [],
        });
        expect(parseSemver("1.2.3-beta.1")).toEqual({
            major: 1,
            minor: 2,
            patch: 3,
            prerelease: ["beta", 1],
        });
        expect(parseSemver("invalid")).toBeNull();
    });

    it("compares versions correctly", () => {
        expect(compareVersions("1.2.3", "1.2.2")).toBeGreaterThan(0);
        expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
        expect(compareVersions("1.2.3", "1.3.0")).toBeLessThan(0);
        // prerelease vs stable
        expect(compareVersions("1.2.3-beta.1", "1.2.3")).toBeLessThan(0);
        expect(compareVersions("1.2.3-beta.1", "1.2.3-beta.2")).toBeLessThan(0);
        expect(compareVersions("1.2.3-beta.2", "1.2.3-beta.10")).toBeLessThan(
            0,
        );
        expect(compareVersions("1.2.3-alpha", "1.2.3-beta")).toBeLessThan(0);
    });

    it("sorts versions descending", () => {
        const sorted = sortVersionsDescending(["1.0.0", "1.2.0", "0.9.0"]);
        expect(sorted).toEqual(["1.2.0", "1.0.0", "0.9.0"]);
    });
});
