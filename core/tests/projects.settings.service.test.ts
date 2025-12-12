import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockGetProjectSettingsRow = vi.fn();

vi.mock("../src/projects/settings/repo", () => ({
    getProjectSettingsRow: (...args: any[]) =>
        mockGetProjectSettingsRow(...args),
    insertProjectSettings: vi.fn(),
    updateProjectSettingsRow: vi.fn(),
}));

vi.mock("../src/projects/repo", () => ({
    getBoardById: vi.fn().mockResolvedValue(null),
}));

describe("projects/settings/service mapRow", () => {
    beforeEach(() => {
        mockGetProjectSettingsRow.mockReset();
    });

    it("falls back safely when dates are invalid or missing", async () => {
        mockGetProjectSettingsRow.mockResolvedValue({
            projectId: "p1",
            baseBranch: "main",
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            allowScriptsToFail: 0,
            allowCopyFilesToFail: 0,
            allowSetupScriptToFail: 0,
            allowDevScriptToFail: 0,
            allowCleanupScriptToFail: 0,
            defaultAgent: null,
            defaultProfileId: null,
            inlineAgent: null,
            inlineProfileId: null,
            autoCommitOnFinish: 0,
            autoPushOnAutocommit: 0,
            ticketPrefix: "PRJ",
            nextTicketNumber: 1,
            githubIssueSyncEnabled: 0,
            githubIssueSyncState: "open",
            githubIssueSyncIntervalMinutes: 15,
            autoCloseTicketOnPRMerge: 0,
            lastGithubIssueSyncAt: "not-a-date",
            lastGithubIssueSyncStatus: "running",
            createdAt: "",
            updatedAt: null,
        });

        const { ensureProjectSettings } = await import(
            "../src/projects/settings/service"
        );
        const settings = await ensureProjectSettings("p1");

        expect(settings.lastGithubIssueSyncAt).toBeNull();
        expect(Number.isNaN(new Date(settings.createdAt).getTime())).toBe(
            false,
        );
        expect(Number.isNaN(new Date(settings.updatedAt).getTime())).toBe(
            false,
        );
    });

    it("normalizes second-based timestamps to ISO strings", async () => {
        const createdSeconds = 1_763_730_982; // 2025-11-21T13:16:22Z
        const updatedSeconds = 1_764_768_545; // 2025-12-04T00:02:25Z
        mockGetProjectSettingsRow.mockResolvedValue({
            projectId: "p1",
            baseBranch: "main",
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            allowScriptsToFail: 0,
            allowCopyFilesToFail: 0,
            allowSetupScriptToFail: 0,
            allowDevScriptToFail: 0,
            allowCleanupScriptToFail: 0,
            defaultAgent: null,
            defaultProfileId: null,
            inlineAgent: null,
            inlineProfileId: null,
            autoCommitOnFinish: 0,
            autoPushOnAutocommit: 0,
            ticketPrefix: "PRJ",
            nextTicketNumber: 1,
            githubIssueSyncEnabled: 0,
            githubIssueSyncState: "open",
            githubIssueSyncIntervalMinutes: 15,
            autoCloseTicketOnPRMerge: 0,
            lastGithubIssueSyncAt: createdSeconds,
            lastGithubIssueSyncStatus: "succeeded",
            createdAt: createdSeconds,
            updatedAt: updatedSeconds,
        });

        const { ensureProjectSettings } = await import(
            "../src/projects/settings/service"
        );
        const settings = await ensureProjectSettings("p1");

        expect(settings.createdAt).toBe(
            new Date(createdSeconds * 1000).toISOString(),
        );
        expect(settings.updatedAt).toBe(
            new Date(updatedSeconds * 1000).toISOString(),
        );
        expect(settings.lastGithubIssueSyncAt).toBe(
            new Date(createdSeconds * 1000).toISOString(),
        );
    });
});
