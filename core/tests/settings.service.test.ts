import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/settings/repo", () => ({
    getAppSettingsRow: vi.fn(),
    insertDefaultAppSettings: vi.fn(),
    updateAppSettingsRow: vi.fn(),
}));

describe("settings/service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("returns existing settings and caches snapshot", async () => {
        const repo = await import("../src/settings/repo");
        const service = await import("../src/settings/service");
        const row = {
            id: "singleton",
            theme: "dark",
            language: "en",
            telemetry_enabled: 1,
            notificationsAgentCompletionSound: 1,
            notificationsDesktop: 0,
            editor_type: "NEOVIM",
            editor_command: "nvim",
            git_user_name: "Jane",
            git_user_email: "jane@example.com",
            branch_template: "{ticketKey}-{slug}",
            gh_pr_title_template: "PR: {ticketKey}",
            gh_pr_body_template: null,
            gh_autolink_tickets: false,
            created_at: new Date("2024-01-01T00:00:00Z"),
            updated_at: new Date("2024-01-02T00:00:00Z"),
        };

        repo.getAppSettingsRow.mockResolvedValueOnce(row);
        const result = await service.ensureAppSettings();

        expect(result).toMatchObject({
            id: "singleton",
            theme: "dark",
            language: "en",
            telemetryEnabled: true,
            notificationsAgentCompletionSound: true,
            editorType: "VS_CODE",
            editorCommand: null,
            ghAutolinkTickets: false,
        });

        expect(service.getAppSettingsSnapshot()).toEqual(result);
        expect(repo.insertDefaultAppSettings).not.toHaveBeenCalled();
    });

    it("initializes default settings when none exist", async () => {
        const repo = await import("../src/settings/repo");
        const service = await import("../src/settings/service");
        const created = {
            id: "singleton",
            theme: "system",
            language: "browser",
            telemetryEnabled: 0,
            notificationsAgentCompletionSound: 0,
            notificationsDesktop: 0,
            editorType: "VS_CODE",
            editorCommand: null,
            gitUserName: null,
            gitUserEmail: null,
            branchTemplate: "{prefix}/{ticketKey}-{slug}",
            ghPrTitleTemplate: null,
            ghPrBodyTemplate: null,
            ghAutolinkTickets: 1,
            createdAt: new Date("2024-02-01T00:00:00Z"),
            updatedAt: new Date("2024-02-01T00:00:00Z"),
        };

        repo.getAppSettingsRow
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(created);

        const result = await service.ensureAppSettings();

        expect(repo.insertDefaultAppSettings).toHaveBeenCalledTimes(1);
        expect(result.theme).toBe("system");
        expect(result.ghAutolinkTickets).toBe(true);
    });

    it("applies updates and normalizes empty strings to null", async () => {
        const repo = await import("../src/settings/repo");
        const service = await import("../src/settings/service");
        const existing = {
            id: "singleton",
            theme: "system",
            language: "browser",
            telemetry_enabled: 0,
            notificationsAgentCompletionSound: 0,
            notificationsDesktop: 0,
            editorType: "VS_CODE",
            editorCommand: null,
            gitUserName: null,
            gitUserEmail: null,
            branchTemplate: "{prefix}/{ticketKey}-{slug}",
            ghPrTitleTemplate: null,
            ghPrBodyTemplate: null,
            ghAutolinkTickets: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        repo.getAppSettingsRow.mockResolvedValue(existing);
        await service.ensureAppSettings();

        await service.updateAppSettings({
            editorCommand: "   ",
            gitUserName: "  Jane  ",
            gitUserEmail: "",
            branchTemplate: undefined,
            notificationsDesktop: true,
        });

        expect(repo.updateAppSettingsRow).toHaveBeenCalledTimes(1);
        expect(repo.updateAppSettingsRow).toHaveBeenCalledWith(
            expect.objectContaining({
                editorCommand: null,
                gitUserName: "  Jane  ",
                gitUserEmail: null,
                notificationsDesktop: true,
            }),
        );
    });

    it("provides defaults snapshot when cache is empty", async () => {
        const repo = await import("../src/settings/repo");
        const service = await import("../src/settings/service");
        repo.getAppSettingsRow
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const snapshot = service.getAppSettingsSnapshot();
        expect(snapshot.id).toBe("singleton");
        expect(snapshot.branchTemplate).toContain("{ticketKey}");
    });
});
