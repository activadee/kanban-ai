import {beforeEach, describe, expect, it, vi} from "vitest";
import {Hono} from "hono";
import {createGithubProjectRouter} from "../src/github/pr-routes";

vi.mock("core", () => {
    class InlineTaskError extends Error {
        kind: string;
        agent: string;
        code: string;
        constructor(params: { kind: string; agent: string; code: string; message: string }) {
            super(params.message);
            this.kind = params.kind;
            this.agent = params.agent;
            this.code = params.code;
        }
    }

    return {
        // Minimal core surface required by pr-routes
        bindAgentEventBus: vi.fn(),
        registerAgent: vi.fn(),
        getAgent: vi.fn(),
        listAgents: vi.fn(),
        CodexAgent: {},
        attempts: {
            getAttempt: vi.fn(),
        },
        attemptsRepo: {},
        projectDeps: {},
        projectsRepo: {
            getCardById: vi.fn(),
            getColumnById: vi.fn(),
        },
        tasks: {},
        git: {
            getStatus: vi.fn(),
        },
        githubRepo: {
            getGithubConnection: vi.fn(),
            findGithubIssueMapping: vi.fn(),
            insertGithubIssueMapping: vi.fn(),
            updateGithubIssueMapping: vi.fn(),
        },
        withTx: async (fn: (tx: unknown) => any) => fn({}),
        projectTickets: {
            previewNextTicketKey: vi.fn(),
            reserveNextTicketKey: vi.fn(),
            isUniqueTicketKeyError: () => false,
        },
        ticketKeys: {
            sanitizeTicketPrefix: (value: string) => value,
            assertValidTicketPrefix: () => {},
        },
        settingsService: {},
        agentProfilesGlobal: {
            getGlobalAgentProfile: vi.fn(),
        },
        agentProfiles: {
            listAgentProfiles: vi.fn(),
            createAgentProfile: vi.fn(),
            getAgentProfile: vi.fn(),
            updateAgentProfile: vi.fn(),
            deleteAgentProfile: vi.fn(),
        },
        agentEnhanceTicket: vi.fn(),
        agentSummarizePullRequest: vi.fn(),
        getGitOriginUrl: vi.fn(),
        parseGithubOwnerRepo: vi.fn(),
        InlineTaskError,
        isInlineTaskError: (err: unknown): err is InlineTaskError =>
            err instanceof InlineTaskError,
    };
});

const createApp = () => {
    const app = new Hono();
    app.route("/projects", createGithubProjectRouter());
    return app;
};

describe("POST /projects/:projectId/pull-requests/summary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 200 and summary on success", async () => {
        const app = createApp();
        const {git, agentSummarizePullRequest} = await import("core");

        (git.getStatus as any).mockResolvedValue({branch: "feature/test"});
        (agentSummarizePullRequest as any).mockResolvedValue({
            title: "PR Title",
            body: "PR Body",
        });

        const res = await app.request(
            "/projects/proj-1/pull-requests/summary",
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({base: "main"}),
            },
        );

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data).toEqual({
            summary: {
                title: "PR Title",
                body: "PR Body",
            },
        });

        expect(git.getStatus).toHaveBeenCalledWith("proj-1");
        expect((agentSummarizePullRequest as any)).toHaveBeenCalledWith({
            projectId: "proj-1",
            baseBranch: "main",
            headBranch: "feature/test",
            attemptId: undefined,
            cardId: undefined,
            agentKey: undefined,
            profileId: undefined,
            signal: expect.any(AbortSignal),
        });
    });

    it("passes attemptId and cardId through to core", async () => {
        const app = createApp();
        const core = await import("core");

        (core.attempts.getAttempt as any).mockResolvedValue({
            id: "a1",
            boardId: "proj-1",
            cardId: "card-1",
        });
        (core.projectsRepo.getCardById as any).mockResolvedValue({
            id: "card-1",
            columnId: "col-1",
            boardId: "proj-1",
        });
        (core.agentSummarizePullRequest as any).mockResolvedValue({
            title: "PR Title",
            body: "PR Body",
        });

        const res = await app.request(
            "/projects/proj-1/pull-requests/summary",
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({branch: "feature/test", attemptId: "a1", cardId: "card-1"}),
            },
        );

        expect(res.status).toBe(200);
        expect(core.attempts.getAttempt).toHaveBeenCalledWith("a1");
        expect(core.projectsRepo.getCardById).toHaveBeenCalledWith("card-1");
        expect((core.agentSummarizePullRequest as any)).toHaveBeenCalledWith({
            projectId: "proj-1",
            baseBranch: undefined,
            headBranch: "feature/test",
            attemptId: "a1",
            cardId: "card-1",
            agentKey: undefined,
            profileId: undefined,
            signal: expect.any(AbortSignal),
        });
    });

    it("returns 400 when attemptId and cardId refer to different cards", async () => {
        const app = createApp();
        const core = await import("core");

        (core.attempts.getAttempt as any).mockResolvedValueOnce({
            id: "a2",
            boardId: "proj-1",
            cardId: "card-from-attempt",
        });

        const res = await app.request(
            "/projects/proj-1/pull-requests/summary",
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({branch: "feature/test", attemptId: "a2", cardId: "card-explicit"}),
            },
        );

        expect(res.status).toBe(400);
        const data = (await res.json()) as any;
        expect(data).toMatchObject({
            status: 400,
            detail: "Attempt cardId does not match provided cardId",
        });
        expect(core.agentSummarizePullRequest).not.toHaveBeenCalled();
    });

    it("returns 409 when branch name is missing", async () => {
        const app = createApp();
        const {git, agentSummarizePullRequest} = await import("core");

        (git.getStatus as any).mockResolvedValue({branch: ""});

        const res = await app.request(
            "/projects/proj-1/pull-requests/summary",
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({}),
            },
        );

        expect(res.status).toBe(409);
        const data = (await res.json()) as any;
        expect(data).toMatchObject({
            status: 409,
            detail: "Branch name missing for PR summary",
        });
        expect(agentSummarizePullRequest).not.toHaveBeenCalled();
    });

    it("returns 400 when agent is unknown", async () => {
        const app = createApp();
        const {git, agentSummarizePullRequest} = await import("core");

        (git.getStatus as any).mockResolvedValue({branch: "feature/test"});
        (agentSummarizePullRequest as any).mockRejectedValue(
            new Error("Unknown agent: UNKNOWN"),
        );

        const res = await app.request(
            "/projects/proj-1/pull-requests/summary",
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({agent: "UNKNOWN"}),
            },
        );

        expect(res.status).toBe(400);
        const data = (await res.json()) as any;
        expect(data).toMatchObject({
            status: 400,
            detail: "Unknown agent: UNKNOWN",
        });
    });

    it("returns 502 when inline task fails", async () => {
        const app = createApp();
        const {git, agentSummarizePullRequest, InlineTaskError} =
            await import("core");

        (git.getStatus as any).mockResolvedValue({branch: "feature/test"});
        (agentSummarizePullRequest as any).mockRejectedValue(
            new (InlineTaskError as any)({
                kind: "prSummary",
                agent: "DROID",
                code: "INLINE_TASK_FAILED",
                message: "Inline task prSummary failed",
            }),
        );

        const res = await app.request(
            "/projects/proj-1/pull-requests/summary",
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({}),
            },
        );

        expect(res.status).toBe(502);
        const data = (await res.json()) as any;
        expect(data).toMatchObject({
            status: 502,
            detail: "Failed to summarize pull request",
        });
    });
});
