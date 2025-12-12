import {beforeEach, describe, expect, it, vi} from "vitest";

const mockProjectsList = vi.fn();
const mockGetSettings = vi.fn();
const mockListColumns = vi.fn();
const mockListCardsForColumns = vi.fn();
const mockGetGithubConnection = vi.fn();
const mockMoveCardToColumnByTitle = vi.fn();
const mockNormalizeInterval = vi.fn((v: any) =>
    typeof v === "number" ? v : 15,
);

vi.mock("core", () => ({
    projectsService: {
        list: (...args: any[]) => mockProjectsList(...args),
        getSettings: (...args: any[]) => mockGetSettings(...args),
    },
    projectsRepo: {
        listColumnsForBoard: (...args: any[]) => mockListColumns(...args),
        listCardsForColumns: (...args: any[]) =>
            mockListCardsForColumns(...args),
    },
    githubRepo: {
        getGithubConnection: (...args: any[]) =>
            mockGetGithubConnection(...args),
    },
    projectSettingsSync: {
        normalizeGithubIssueSyncInterval: (...args: any[]) =>
            mockNormalizeInterval(...args),
    },
    tasks: {
        moveCardToColumnByTitle: (...args: any[]) =>
            mockMoveCardToColumnByTitle(...args),
    },
}));

const mockGetPullRequest = vi.fn();
vi.mock("../src/github/pr", () => ({
    getPullRequest: (...args: any[]) => mockGetPullRequest(...args),
}));

describe("github PR auto-close scheduler", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        mockGetGithubConnection.mockResolvedValue({
            accessToken: "token",
        });

        mockProjectsList.mockResolvedValue([
            {
                id: "p1",
                boardId: "p1",
                repositoryPath: "/repo/p1",
            },
        ]);

        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: true,
            githubIssueSyncIntervalMinutes: 1,
        });

        mockListColumns.mockResolvedValue([
            {id: "col-review", title: "Review"},
            {id: "col-done", title: "Done"},
        ]);

        mockListCardsForColumns.mockResolvedValue([
            {
                id: "card-1",
                boardId: "p1",
                columnId: "col-review",
                ticketKey: "PRJ-1",
                prUrl: "https://github.com/o/r/pull/12",
                disableAutoCloseOnPRMerge: false,
            },
            {
                id: "card-2",
                boardId: "p1",
                columnId: "col-review",
                ticketKey: "PRJ-2",
                prUrl: "https://github.com/o/r/pull/12",
                disableAutoCloseOnPRMerge: true,
            },
        ]);
    });

    it("moves review cards to Done when PR is merged", async () => {
        mockGetPullRequest.mockResolvedValue({
            number: 12,
            state: "closed",
            merged: true,
        });

        const events = {publish: vi.fn()} as any;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events);

        expect(mockGetPullRequest).toHaveBeenCalledWith(
            "p1",
            "token",
            12,
        );
        expect(mockMoveCardToColumnByTitle).toHaveBeenCalledTimes(1);
        expect(mockMoveCardToColumnByTitle).toHaveBeenCalledWith(
            "p1",
            "card-1",
            "Done",
        );
        expect(events.publish).toHaveBeenCalledWith(
            "github.pr.merged.autoClosed",
            expect.objectContaining({cardId: "card-1", prNumber: 12}),
        );
    });

    it("skips when auto-close is disabled", async () => {
        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: false,
            githubIssueSyncIntervalMinutes: 1,
        });

        const events = {publish: vi.fn()} as any;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events);

        expect(mockGetPullRequest).not.toHaveBeenCalled();
        expect(mockMoveCardToColumnByTitle).not.toHaveBeenCalled();
    });
});

