import {beforeEach, describe, expect, it, vi} from "vitest";
import type {AppEventBus} from "../src/events/bus";

// Mock core to avoid Node ESM loader trying to resolve Bun workspace URLs.
vi.mock("core", () => ({
    projectsService: {},
    projectsRepo: {},
    githubRepo: {},
    projectSettingsPrAutoClose: {},
    tasks: {},
    getGitOriginUrl: () => null,
    parseGithubOwnerRepo: () => null,
}));

const mockProjectsList = vi.fn();
const mockGetSettings = vi.fn();
const mockListColumns = vi.fn();
const mockListCardsForColumns = vi.fn();
const mockGetGithubConnection = vi.fn();
const mockMoveBoardCard = vi.fn();
const mockBroadcastBoard = vi.fn();
const mockIsEnabled = vi.fn(
    (settings: {autoCloseTicketOnPRMerge?: boolean}) =>
        Boolean(settings.autoCloseTicketOnPRMerge),
);
const mockIsDue = vi.fn(() => true);
const mockTryStart = vi.fn().mockResolvedValue(true);
const mockComplete = vi.fn().mockResolvedValue(undefined);
const mockGetGitOriginUrl = vi.fn().mockResolvedValue("https://github.com/o/r.git");
const mockParseGithubOwnerRepo = vi.fn().mockReturnValue({owner: "o", repo: "r"});

const mockGetPullRequest = vi.fn();

function makeDeps() {
    return {
        getPullRequest: mockGetPullRequest,
        projectsService: {
            list: mockProjectsList,
            getSettings: mockGetSettings,
        },
        projectsRepo: {
            listColumnsForBoard: mockListColumns,
            listCardsForColumns: mockListCardsForColumns,
        },
        githubRepo: {
            getGithubConnection: mockGetGithubConnection,
        },
        projectSettingsPrAutoClose: {
            isGithubPrAutoCloseEnabled: mockIsEnabled,
            isGithubPrAutoCloseDue: mockIsDue,
            tryStartGithubPrAutoClose: mockTryStart,
            completeGithubPrAutoClose: mockComplete,
        },
        tasks: {
            moveBoardCard: mockMoveBoardCard,
            broadcastBoard: mockBroadcastBoard,
        },
        getGitOriginUrl: mockGetGitOriginUrl,
        parseGithubOwnerRepo: mockParseGithubOwnerRepo,
    };
}

describe("github PR auto-close scheduler", () => {
    beforeEach(async () => {
        mockProjectsList.mockReset();
        mockGetSettings.mockReset();
        mockListColumns.mockReset();
        mockListCardsForColumns.mockReset();
        mockGetGithubConnection.mockReset();
        mockMoveBoardCard.mockReset();
        mockBroadcastBoard.mockReset();
        mockIsEnabled.mockReset();
        mockIsDue.mockReset();
        mockTryStart.mockReset();
        mockComplete.mockReset();
        mockGetGitOriginUrl.mockReset();
        mockParseGithubOwnerRepo.mockReset();
        mockGetPullRequest.mockReset();

        mockIsEnabled.mockImplementation(
            (settings: {autoCloseTicketOnPRMerge?: boolean}) =>
                Boolean(settings.autoCloseTicketOnPRMerge),
        );
        mockIsDue.mockReturnValue(true);
        mockTryStart.mockResolvedValue(true);
        mockComplete.mockResolvedValue(undefined);
        mockGetGitOriginUrl.mockResolvedValue("https://github.com/o/r.git");
        mockParseGithubOwnerRepo.mockReturnValue({owner: "o", repo: "r"});

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
            lastGithubPrAutoCloseAt: null,
            lastGithubPrAutoCloseStatus: "idle",
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
            url: "https://github.com/o/r/pull/12",
            state: "closed",
            merged: true,
        });

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockProjectsList).toHaveBeenCalledTimes(1);
        expect(mockGetSettings).toHaveBeenCalledWith("p1");
        expect(mockGetGitOriginUrl).toHaveBeenCalledWith("/repo/p1");
        expect(mockParseGithubOwnerRepo).toHaveBeenCalledWith(
            "https://github.com/o/r.git",
        );
        expect(mockListColumns).toHaveBeenCalledWith("p1");
        expect(mockListCardsForColumns).toHaveBeenCalledWith(["col-review"]);

        expect(mockGetPullRequest).toHaveBeenCalledWith(
            "p1",
            "token",
            12,
        );
        expect(mockMoveBoardCard).toHaveBeenCalledTimes(1);
        expect(mockMoveBoardCard).toHaveBeenCalledWith(
            "card-1",
            "col-done",
            Number.MAX_SAFE_INTEGER,
            {suppressBroadcast: true},
        );
        expect(mockBroadcastBoard).toHaveBeenCalledWith("p1");
        expect(events.publish).toHaveBeenCalledWith(
            "github.pr.merged.autoClosed",
            expect.objectContaining({cardId: "card-1", prNumber: 12}),
        );
    });

    it("skips when auto-close is disabled", async () => {
        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: false,
            githubIssueSyncIntervalMinutes: 1,
            lastGithubPrAutoCloseAt: null,
            lastGithubPrAutoCloseStatus: "idle",
        });

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetPullRequest).not.toHaveBeenCalled();
        expect(mockMoveBoardCard).not.toHaveBeenCalled();
        expect(mockBroadcastBoard).not.toHaveBeenCalled();
    });

    it("skips PR URLs that are not on a GitHub hostname", async () => {
        mockListCardsForColumns.mockResolvedValue([
            {
                id: "card-1",
                boardId: "p1",
                columnId: "col-review",
                ticketKey: "PRJ-1",
                prUrl: "https://evilgithub.com/o/r/pull/12",
                disableAutoCloseOnPRMerge: false,
            },
        ]);

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetPullRequest).not.toHaveBeenCalled();
        expect(mockMoveBoardCard).not.toHaveBeenCalled();
        expect(mockBroadcastBoard).not.toHaveBeenCalled();
    });

    it("still works when Review/Done titles are renamed (uses default ids)", async () => {
        mockListColumns.mockResolvedValue([
            {id: "col-review", title: "QA"},
            {id: "col-done", title: "Shipped"},
        ]);

        mockGetPullRequest.mockResolvedValue({
            number: 12,
            url: "https://github.com/o/r/pull/12",
            state: "closed",
            merged: true,
        });

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetPullRequest).toHaveBeenCalledWith(
            "p1",
            "token",
            12,
        );
        expect(mockMoveBoardCard).toHaveBeenCalledWith(
            "card-1",
            "col-done",
            Number.MAX_SAFE_INTEGER,
            {suppressBroadcast: true},
        );
        expect(mockBroadcastBoard).toHaveBeenCalledWith("p1");
    });
});
