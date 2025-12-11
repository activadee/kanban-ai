import {describe, it, expect} from "vitest";
import {
    getAgentSettingsPath,
    getAttemptPath,
    getDashboardPath,
    getProjectCardPath,
    getProjectPath,
    getProjectsPath,
    getSettingsPath,
} from "@/lib/routes";

describe("routes helpers", () => {
    it("builds attempt paths", () => {
        expect(getAttemptPath("123")).toBe("/attempts/123");
        expect(getAttemptPath("id with space")).toBe(
            "/attempts/id%20with%20space",
        );
    });

    it("builds project and card paths", () => {
        expect(getProjectPath("alpha")).toBe("/projects/alpha");
        expect(getProjectCardPath("alpha", null)).toBe("/projects/alpha");
        expect(getProjectCardPath("alpha", "card-1")).toBe(
            "/projects/alpha?cardId=card-1",
        );
    });

    it("builds other dashboard-related paths", () => {
        expect(getProjectsPath()).toBe("/projects");
        expect(getDashboardPath()).toBe("/dashboard");
        expect(getSettingsPath()).toBe("/settings");
        expect(getAgentSettingsPath("CODEX")).toBe("/agents/CODEX");
    });
});
