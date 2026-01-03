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
const mockGetCardById = vi.fn();
const mockGetGithubConnection = vi.fn();
const mockMoveBoardCard = vi.fn();
const mockBroadcastBoard = vi.fn();
const mockIsEnabled = vi.fn(
    (settings: {autoCloseTicketOnPRMerge?: boolean}) =>
        Boolean(settings.autoCloseTicketOnPRMerge),
);
const mockIssueAutoCloseEnabled = vi.fn(
    (settings: {autoCloseTicketOnIssueClose?: boolean}) =>
        Boolean(settings.autoCloseTicketOnIssueClose),
);
const mockIsDue = vi.fn(() => true);
const mockIssueAutoCloseDue = vi.fn(() => true);
const mockTryStart = vi.fn().mockResolvedValue(true);
const mockComplete = vi.fn().mockResolvedValue(undefined);
const mockGetGitOriginUrl = vi.fn().mockResolvedValue("https://github.com/o/r.git");
const mockParseGithubOwnerRepo = vi.fn().mockReturnValue({owner: "o", repo: "r"});

const mockGetPullRequest = vi.fn();
const mockGetIssue = vi.fn();
const mockListCardsWithGithubIssuesNotInDone = vi.fn();

function makeDeps() {
    return {
        getPullRequest: mockGetPullRequest,
        getIssue: mockGetIssue,
        projectsService: {
            list: mockProjectsList,
            getSettings: mockGetSettings,
        },
        projectsRepo: {
            listColumnsForBoard: mockListColumns,
            listCardsForColumns: mockListCardsForColumns,
            getCardById: mockGetCardById,
        },
        githubRepo: {
            getGithubConnection: mockGetGithubConnection,
            listCardsWithGithubIssuesNotInDone: mockListCardsWithGithubIssuesNotInDone,
        },
        projectSettingsPrAutoClose: {
            isGithubPrAutoCloseEnabled: mockIsEnabled,
            isGithubIssueAutoCloseEnabled: mockIssueAutoCloseEnabled,
            isGithubPrAutoCloseDue: mockIsDue,
            isGithubIssueAutoCloseDue: mockIssueAutoCloseDue,
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
        mockGetCardById.mockReset();
        mockGetGithubConnection.mockReset();
        mockMoveBoardCard.mockReset();
        mockBroadcastBoard.mockReset();
        mockIsEnabled.mockReset();
        mockIssueAutoCloseEnabled.mockReset();
        mockIsDue.mockReset();
        mockIssueAutoCloseDue.mockReset();
        mockTryStart.mockReset();
        mockComplete.mockReset();
        mockGetGitOriginUrl.mockReset();
        mockParseGithubOwnerRepo.mockReset();
        mockGetPullRequest.mockReset();
        mockGetIssue.mockReset();
        mockListCardsWithGithubIssuesNotInDone.mockReset();

        mockIsEnabled.mockImplementation(
            (settings: {autoCloseTicketOnPRMerge?: boolean}) =>
                Boolean(settings.autoCloseTicketOnPRMerge),
        );
        mockIssueAutoCloseEnabled.mockImplementation(
            (settings: {autoCloseTicketOnIssueClose?: boolean}) =>
                Boolean(settings.autoCloseTicketOnIssueClose),
        );
        mockIsDue.mockReturnValue(true);
        mockIssueAutoCloseDue.mockReturnValue(true);
        mockTryStart.mockResolvedValue(true);
        mockComplete.mockResolvedValue(undefined);
        mockGetGitOriginUrl.mockResolvedValue("https://github.com/o/r.git");
        mockParseGithubOwnerRepo.mockReturnValue({owner: "o", repo: "r"});

        mockGetGithubConnection.mockResolvedValue({
            accessToken: "token",
        });

        mockListCardsWithGithubIssuesNotInDone.mockResolvedValue([]);

        mockProjectsList.mockResolvedValue([
            {
                id: "proj-1",
                boardId: "board-1",
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
            {id: "col-123", title: "Review"},
            {id: "col-456", title: "Done"},
        ]);

        mockListCardsForColumns.mockResolvedValue([
            {
                id: "card-1",
                boardId: "board-1",
                columnId: "col-123",
                ticketKey: "PRJ-1",
                prUrl: "https://github.com/o/r/pull/12",
                disableAutoCloseOnPRMerge: false,
            },
            {
                id: "card-2",
                boardId: "board-1",
                columnId: "col-123",
                ticketKey: "PRJ-2",
                prUrl: "https://github.com/o/r/pull/12",
                disableAutoCloseOnPRMerge: true,
            },
        ]);

        mockGetCardById.mockImplementation(async (cardId: string) => {
            if (cardId === "card-1") {
                return {
                    id: "card-1",
                    boardId: "board-1",
                    columnId: "col-123",
                    ticketKey: "PRJ-1",
                    prUrl: "https://github.com/o/r/pull/12",
                    disableAutoCloseOnPRMerge: false,
                };
            }
            if (cardId === "card-2") {
                return {
                    id: "card-2",
                    boardId: "board-1",
                    columnId: "col-123",
                    ticketKey: "PRJ-2",
                    prUrl: "https://github.com/o/r/pull/12",
                    disableAutoCloseOnPRMerge: true,
                };
            }
            return null;
        });
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
        expect(mockGetSettings).toHaveBeenCalledWith("proj-1");
        expect(mockGetGitOriginUrl).toHaveBeenCalledWith("/repo/p1");
        expect(mockParseGithubOwnerRepo).toHaveBeenCalledWith(
            "https://github.com/o/r.git",
        );
        expect(mockListColumns).toHaveBeenCalledWith("board-1");
        expect(mockListCardsForColumns).toHaveBeenCalledWith(["col-123"]);

        expect(mockGetPullRequest).toHaveBeenCalledWith(
            "proj-1",
            "token",
            12,
        );
        expect(mockGetCardById).toHaveBeenCalledWith("card-1");
        expect(mockMoveBoardCard).toHaveBeenCalledTimes(1);
        expect(mockMoveBoardCard).toHaveBeenCalledWith(
            "card-1",
            "col-456",
            Number.MAX_SAFE_INTEGER,
            {suppressBroadcast: true},
        );
        expect(mockBroadcastBoard).toHaveBeenCalledWith("board-1");
        expect(events.publish).toHaveBeenCalledWith(
            "github.pr.merged.autoClosed",
            expect.objectContaining({
                cardId: "card-1",
                prNumber: 12,
                projectId: "proj-1",
                boardId: "board-1",
            }),
        );
    });

    it("skips when auto-close is disabled", async () => {
        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: false,
            autoCloseTicketOnIssueClose: false,
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
                boardId: "board-1",
                columnId: "col-123",
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

    it("skips when Review/Done columns are not present by title", async () => {
        mockListColumns.mockResolvedValue([
            {id: "col-123", title: "QA"},
            {id: "col-456", title: "Shipped"},
        ]);

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetPullRequest).not.toHaveBeenCalled();
        expect(mockMoveBoardCard).not.toHaveBeenCalled();
        expect(mockBroadcastBoard).not.toHaveBeenCalled();
        expect(mockComplete).toHaveBeenCalledWith(
            "proj-1",
            "failed",
            expect.any(Date),
        );
    });

    it("does not move cards that changed after initial query", async () => {
        mockGetPullRequest.mockResolvedValue({
            number: 12,
            url: "https://github.com/o/r/pull/12",
            state: "closed",
            merged: true,
        });

        mockGetCardById.mockResolvedValue({
            id: "card-1",
            boardId: "board-1",
            columnId: "col-456",
            ticketKey: "PRJ-1",
            prUrl: "https://github.com/o/r/pull/12",
            disableAutoCloseOnPRMerge: false,
        });
        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetPullRequest).toHaveBeenCalledTimes(1);
        expect(mockMoveBoardCard).not.toHaveBeenCalled();
        expect(mockBroadcastBoard).not.toHaveBeenCalled();
        expect(events.publish).not.toHaveBeenCalled();
    });

    it("stops the tick early across projects on GitHub auth/rate errors", async () => {
        mockProjectsList.mockResolvedValue([
            {id: "proj-1", boardId: "board-1", repositoryPath: "/repo/p1"},
            {id: "proj-2", boardId: "board-2", repositoryPath: "/repo/p2"},
        ]);

        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: true,
            githubIssueSyncIntervalMinutes: 1,
            lastGithubPrAutoCloseAt: null,
            lastGithubPrAutoCloseStatus: "idle",
        });

        mockListColumns.mockResolvedValue([
            {id: "col-123", title: "Review"},
            {id: "col-456", title: "Done"},
        ]);

        mockListCardsForColumns.mockResolvedValue([
            {
                id: "card-1",
                boardId: "board-1",
                columnId: "col-123",
                ticketKey: "PRJ-1",
                prUrl: "https://github.com/o/r/pull/12",
                disableAutoCloseOnPRMerge: false,
            },
        ]);

        mockGetPullRequest.mockRejectedValue(new Error("Request failed (401)"));

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetPullRequest).toHaveBeenCalledTimes(1);
        expect(mockGetSettings).toHaveBeenCalledTimes(1);
        expect(mockTryStart).toHaveBeenCalledTimes(1);
    });

    it("moves cards to Done when GitHub issue is closed", async () => {
        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: false,
            autoCloseTicketOnIssueClose: true,
            githubIssueSyncIntervalMinutes: 1,
            lastGithubPrAutoCloseAt: null,
            lastGithubPrAutoCloseStatus: "idle",
        });

        mockListCardsForColumns.mockResolvedValue([]);

        mockListCardsWithGithubIssuesNotInDone.mockResolvedValue([
            {
                id: "card-issue-1",
                boardId: "board-1",
                columnId: "col-123",
                ticketKey: "PRJ-10",
                title: "Issue card",
                description: "",
                order: 0,
                isEnhanced: false,
                prUrl: null,
                ticketType: null,
                disableAutoCloseOnPRMerge: false,
                disableAutoCloseOnIssueClose: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                issueNumber: 42,
                owner: "o",
                repo: "r",
            },
        ]);

        mockGetIssue.mockResolvedValue({
            id: 123,
            number: 42,
            title: "Test issue",
            state: "closed",
            html_url: "https://github.com/o/r/issues/42",
        });

        mockGetCardById.mockImplementation(async (cardId: string) => {
            if (cardId === "card-issue-1") {
                return {
                    id: "card-issue-1",
                    boardId: "board-1",
                    columnId: "col-123",
                    ticketKey: "PRJ-10",
                    prUrl: null,
                    disableAutoCloseOnPRMerge: false,
                    disableAutoCloseOnIssueClose: false,
                };
            }
            return null;
        });

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetIssue).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            issueNumber: 42,
            token: "token",
        });
        expect(mockMoveBoardCard).toHaveBeenCalledWith(
            "card-issue-1",
            "col-456",
            Number.MAX_SAFE_INTEGER,
            {suppressBroadcast: true},
        );
        expect(events.publish).toHaveBeenCalledWith(
            "github.issue.closed.autoClosed",
            expect.objectContaining({
                cardId: "card-issue-1",
                issueNumber: 42,
                projectId: "proj-1",
                boardId: "board-1",
            }),
        );
    });

    it("skips when GitHub issue is still open", async () => {
        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: false,
            autoCloseTicketOnIssueClose: true,
            githubIssueSyncIntervalMinutes: 1,
            lastGithubPrAutoCloseAt: null,
            lastGithubPrAutoCloseStatus: "idle",
        });
        mockListCardsForColumns.mockResolvedValue([]);
        mockListCardsWithGithubIssuesNotInDone.mockResolvedValue([
            {
                id: "card-issue-2",
                boardId: "board-1",
                columnId: "col-123",
                ticketKey: "PRJ-11",
                title: "Issue card",
                description: "",
                order: 0,
                isEnhanced: false,
                prUrl: null,
                ticketType: null,
                disableAutoCloseOnPRMerge: false,
                disableAutoCloseOnIssueClose: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                issueNumber: 43,
                owner: "o",
                repo: "r",
            },
        ]);

        mockGetIssue.mockResolvedValue({
            id: 124,
            number: 43,
            title: "Test issue",
            state: "open",
            html_url: "https://github.com/o/r/issues/43",
        });

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockGetIssue).toHaveBeenCalled();
        expect(mockMoveBoardCard).not.toHaveBeenCalled();
        expect(events.publish).not.toHaveBeenCalledWith(
            "github.issue.closed.autoClosed",
            expect.anything(),
        );
    });

    it("skips cards with disableAutoCloseOnIssueClose when checking issues", async () => {
        mockGetSettings.mockResolvedValue({
            autoCloseTicketOnPRMerge: false,
            autoCloseTicketOnIssueClose: true,
            githubIssueSyncIntervalMinutes: 1,
            lastGithubPrAutoCloseAt: null,
            lastGithubPrAutoCloseStatus: "idle",
        });
        mockListCardsForColumns.mockResolvedValue([]);
        mockListCardsWithGithubIssuesNotInDone.mockResolvedValue([
            {
                id: "card-1",
                boardId: "board-1",
                columnId: "col-123",
                ticketKey: "ISSUE-1",
                issueNumber: 100,
                disableAutoCloseOnPRMerge: false,
                disableAutoCloseOnIssueClose: true,
                owner: "owner",
                repo: "repo",
            },
        ]);
        mockGetCardById.mockResolvedValue({
            id: "card-1",
            boardId: "board-1",
            columnId: "col-123",
            ticketKey: "ISSUE-1",
            disableAutoCloseOnPRMerge: false,
            disableAutoCloseOnIssueClose: true,
        });
        mockGetIssue.mockResolvedValue({
            number: 100,
            title: "Test Issue",
            state: "closed",
            html_url: "https://github.com/owner/repo/issues/100",
        });

        const events = {publish: vi.fn()} as unknown as AppEventBus;
        const {runGithubPrAutoCloseTick} = await import(
            "../src/github/pr-auto-close.sync"
        );

        await runGithubPrAutoCloseTick(events, makeDeps());

        expect(mockListCardsWithGithubIssuesNotInDone).toHaveBeenCalledWith(
            "board-1",
            ["col-456"],
        );
        expect(mockMoveBoardCard).not.toHaveBeenCalled();
        expect(events.publish).not.toHaveBeenCalledWith(
            "github.issue.closed.autoClosed",
            expect.anything(),
        );
    });
});
