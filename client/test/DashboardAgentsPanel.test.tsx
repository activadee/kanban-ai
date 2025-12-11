import React from "react";
import {describe, it, expect, beforeEach, vi} from "vitest";
import {render, cleanup, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {MemoryRouter} from "react-router-dom";
import type {DashboardOverview} from "shared";
import {DashboardPage} from "@/pages/DashboardPage";

const dashboardMocks = vi.hoisted(() => ({
    useDashboardOverview: vi.fn(),
    useDashboardStream: vi.fn(),
}));

const githubMocks = vi.hoisted(() => ({
    useGithubAuthStatus: vi.fn(() => ({
        data: {status: "valid", account: {username: "dev"}},
        isLoading: false,
    })),
}));

const agentsMocks = vi.hoisted(() => ({
    useAgents: vi.fn(() => ({
        data: {
            agents: [
                {key: "AGENT", label: "Fixture Agent"},
                {key: "IDLE", label: "Idle Agent"},
            ],
        },
        isLoading: false,
    })),
}));

vi.mock("@/hooks", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/hooks")>();
    return {
        ...actual,
        useDashboardOverview: dashboardMocks.useDashboardOverview,
        useDashboardStream: dashboardMocks.useDashboardStream,
        useGithubAuthStatus: githubMocks.useGithubAuthStatus,
        useAgents: agentsMocks.useAgents,
    };
});

function createOverview(): DashboardOverview {
    const now = new Date().toISOString();
    return {
        timeRange: {preset: "last_7d"},
        generatedAt: now,
        metrics: {
            byKey: {},
        },
        activeAttempts: [],
        recentAttemptActivity: [],
        inboxItems: {
            review: [],
            failed: [],
            stuck: [],
        },
        projectSnapshots: [],
        agentStats: [
            {
                agentId: "AGENT",
                agentName: "Fixture Agent",
                status: "online",
                attemptsStarted: 4,
                attemptsSucceeded: 2,
                attemptsFailed: 2,
                attemptsInRange: 4,
                successRateInRange: 0.5,
                lastActivityAt: now,
                hasActivityInRange: true,
            },
            {
                agentId: "IDLE",
                agentName: "Idle Agent",
                status: "online",
                attemptsStarted: 0,
                attemptsSucceeded: 0,
                attemptsFailed: 0,
                attemptsInRange: 0,
                successRateInRange: null,
                lastActivityAt: null,
                hasActivityInRange: false,
            },
        ],
        attemptsInRange: 4,
        successRateInRange: 0.5,
        projectsWithActivityInRange: 1,
    };
}

describe("DashboardPage – Agents panel", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();

        dashboardMocks.useDashboardOverview.mockReturnValue({
            data: createOverview(),
            isLoading: false,
            isFetching: false,
        });
    });

    function createClient() {
        const client = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                    staleTime: 0,
                },
            },
        });
        return client;
    }

    it("renders per-agent stats with activity and inactivity states", () => {
        const client = createClient();

        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <DashboardPage/>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(screen.getByText("Fixture Agent")).toBeTruthy();
        expect(screen.getByText("Idle Agent")).toBeTruthy();

        // Active agent shows attempts in range and a success rate.
        expect(screen.getByText(/4 attempts in range/i)).toBeTruthy();

        // Idle agent is shown with no attempts and an inactive badge.
        expect(
            screen.getByText(/No attempts in selected time range/i),
        ).toBeTruthy();
        expect(screen.getByText(/Inactive in this range/i)).toBeTruthy();
    });

    it("shows a friendly empty-state message when there are no agent stats", () => {
        dashboardMocks.useDashboardOverview.mockReturnValueOnce({
            data: {
                ...createOverview(),
                agentStats: [],
                attemptsInRange: 0,
                successRateInRange: 0,
                projectsWithActivityInRange: 0,
            },
            isLoading: false,
            isFetching: false,
        });

        const client = createClient();

        render(
            <QueryClientProvider client={client}>
            <MemoryRouter>
                <DashboardPage/>
            </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(
            screen.getByText(/No attempts in the selected time range yet\./i),
        ).toBeTruthy();
    });

    it("shows GitHub connected state and a ready-to-work readiness indicator", () => {
        const client = createClient();

        githubMocks.useGithubAuthStatus.mockReturnValueOnce({
            data: {status: "valid", account: {username: "dev"}},
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        });

        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <DashboardPage/>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(screen.getByText(/System readiness/i)).toBeTruthy();
        expect(screen.getByText(/Ready to work/i)).toBeTruthy();
        expect(screen.getByText(/Connected as dev/i)).toBeTruthy();
        expect(screen.getByLabelText(/GitHub integration status: Connected/i)).toBeTruthy();
    });

    it("surfaces clear guidance when GitHub is disconnected and no agents are configured", () => {
        const client = createClient();

        githubMocks.useGithubAuthStatus.mockReturnValueOnce({
            data: {status: "invalid"},
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        });

        agentsMocks.useAgents.mockReturnValueOnce({
            data: {agents: []},
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        });

        dashboardMocks.useDashboardOverview.mockReturnValueOnce({
            data: {
                ...createOverview(),
                agentStats: [],
                attemptsInRange: 0,
                successRateInRange: 0,
                projectsWithActivityInRange: 0,
            },
            isLoading: false,
            isFetching: false,
            isError: false,
            refetch: vi.fn(),
        });

        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <DashboardPage/>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(screen.getByText(/Action required/i)).toBeTruthy();
        expect(
            screen.getByText(/Connect GitHub to enable code-aware agents/i),
        ).toBeTruthy();
        expect(
            screen.getByRole("link", {name: /Connect GitHub/i}),
        ).toBeTruthy();
        expect(
            screen.getByText(/No agents are active yet/i),
        ).toBeTruthy();
    });

    it("shows non-blocking error messaging when agent stats fail to load", () => {
        const client = createClient();

        dashboardMocks.useDashboardOverview.mockReturnValueOnce({
            data: undefined,
            isLoading: false,
            isFetching: false,
            isError: true,
            refetch: vi.fn(),
        });

        agentsMocks.useAgents.mockReturnValueOnce({
            data: {agents: []},
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        });

        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <DashboardPage/>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(
            screen.getByText(/Unable to load agent stats\./i),
        ).toBeTruthy();
        expect(
            screen.getAllByRole("button", {name: /Retry/i}).length,
        ).toBeGreaterThanOrEqual(1);
    });
});
