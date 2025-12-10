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

    it("renders per-agent stats with activity and inactivity states", () => {
        const client = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                    staleTime: 0,
                },
            },
        });

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
            },
            isLoading: false,
            isFetching: false,
        });

        const client = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                    staleTime: 0,
                },
            },
        });

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
});
