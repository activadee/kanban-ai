import {describe, it, expect, beforeEach, vi} from "vitest";
import {Hono} from "hono";
import {createProjectsRouter} from "../src/projects/project.routes";

vi.mock("core", () => {
    return {
        bindAgentEventBus: vi.fn(),
        registerAgent: vi.fn(),
        getAgent: vi.fn(),
        listAgents: vi.fn(),
        CodexAgent: {},
        // Attempts/tasks/projects - only shape needed for imports
        attempts: {},
        attemptsRepo: {},
        projectDeps: {},
        projectsRepo: {},
        tasks: {},
        // Git/GitHub
        git: {},
        githubRepo: {
            getGithubConnection: vi.fn(),
            findGithubIssueMapping: vi.fn(),
            insertGithubIssueMapping: vi.fn(),
            updateGithubIssueMapping: vi.fn(),
        },
        withTx: async (fn: (tx: unknown) => any) => fn({}),
        // Tickets/settings
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
        projectSubtasks: {
            listSubtasksWithProgress: vi.fn(),
            createSubtask: vi.fn(),
            updateSubtask: vi.fn(),
            deleteSubtask: vi.fn(),
            reorderSubtasks: vi.fn(),
            getSubtaskById: vi.fn(),
        },
        getGitOriginUrl: vi.fn(),
        parseGithubOwnerRepo: vi.fn(),
    };
});

const createApp = () => {
    const app = new Hono();
    app.route("/projects", createProjectsRouter());
    return app;
};

describe("POST /projects/:projectId/tickets/enhance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 200 and enhanced ticket on success", async () => {
        const app = createApp();
        const {agentEnhanceTicket} = await import("core");
        (agentEnhanceTicket as any).mockResolvedValue({
            title: "Enhanced Title",
            description: "Enhanced Description",
        });

        const res = await app.request("/projects/proj-1/tickets/enhance", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                title: "Original Title",
                description: "Original Description",
            }),
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data).toEqual({
            ticket: {
                title: "Enhanced Title",
                description: "Enhanced Description",
            },
        });
        expect((agentEnhanceTicket as any)).toHaveBeenCalledWith({
            projectId: "proj-1",
            title: "Original Title",
            description: "Original Description",
            agentKey: undefined,
            profileId: undefined,
        });
    });

    it("returns problem JSON when project is not found", async () => {
        const app = createApp();
        const {agentEnhanceTicket} = await import("core");
        (agentEnhanceTicket as any).mockRejectedValue(
            new Error("Project not found"),
        );

        const res = await app.request("/projects/missing-project/tickets/enhance", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                title: "Original Title",
                description: "Original Description",
            }),
        });

        expect(res.status).toBe(404);
        const data = (await res.json()) as any;
        expect(data).toMatchObject({
            status: 404,
            detail: "Project not found",
        });
    });

    it("returns 400 when agent is unknown", async () => {
        const app = createApp();
        const {agentEnhanceTicket} = await import("core");
        (agentEnhanceTicket as any).mockRejectedValue(
            new Error("Unknown agent: UNKNOWN"),
        );

        const res = await app.request("/projects/proj-1/tickets/enhance", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                title: "Original Title",
                description: "Original Description",
                agent: "UNKNOWN",
            }),
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as any;
        expect(data).toMatchObject({
            status: 400,
            detail: "Unknown agent: UNKNOWN",
        });
    });

    it("returns 400 when agent does not implement enhance()", async () => {
        const app = createApp();
        const {agentEnhanceTicket} = await import("core");
        (agentEnhanceTicket as any).mockRejectedValue(
            new Error("Agent CODEX does not support ticket enhancement"),
        );

        const res = await app.request("/projects/proj-1/tickets/enhance", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                title: "Original Title",
                description: "Original Description",
                agent: "CODEX",
            }),
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as any;
        expect(data).toMatchObject({
            status: 400,
            detail: "Agent CODEX does not support ticket enhancement",
        });
    });

    // Inline agent fallback now uses the project's default agent (or DROID)
    // when no inline agent is configured, so there is no dedicated 400 case.
});
