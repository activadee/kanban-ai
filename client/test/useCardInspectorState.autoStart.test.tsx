import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    render,
    cleanup,
    screen,
    waitFor,
    act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Card } from "shared";

import { eventBus } from "@/lib/events";
import { useCardInspectorState } from "@/components/kanban/card-inspector/useCardInspectorState";

const { attemptDetailRef, getAttemptDetailForCardMock } = vi.hoisted(() => {
    const ref: { current: null | { attempt: any; logs: any[]; conversation: any[] } } = {
        current: null,
    };

    const getAttemptDetailForCard = vi.fn(async () => {
        if (!ref.current) {
            throw new Error("Attempt not found");
        }
        return ref.current;
    });

    return { attemptDetailRef: ref, getAttemptDetailForCardMock: getAttemptDetailForCard };
});

vi.mock("@/api/attempts", () => ({
    getAttemptDetailForCard: getAttemptDetailForCardMock,
    getAttempt: vi.fn(),
    getAttemptLogs: vi.fn(),
    startAttemptRequest: vi.fn(),
    followupAttemptRequest: vi.fn(),
    stopAttemptRequest: vi.fn(),
    openAttemptEditor: vi.fn(),
    runDevAutomationRequest: vi.fn(),
}));

vi.mock("@/api/agents", () => ({
    listAgents: vi.fn(async () => ({
        agents: [{ key: "AGENT", label: "Test Agent" }],
    })),
    listAgentProfiles: vi.fn(async () => []),
    getAgentSchema: vi.fn(),
    createAgentProfileRequest: vi.fn(),
    updateAgentProfileRequest: vi.fn(),
    deleteAgentProfileRequest: vi.fn(),
}));

vi.mock("@/api/settings", () => ({
    getAppSettings: vi.fn(async () => ({
        id: "settings-1",
        theme: "system",
        language: "browser",
        telemetryEnabled: false,
        notificationsAgentCompletionSound: false,
        notificationsDesktop: false,
        autoStartAgentOnInProgress: true,
        editorType: "VS_CODE",
        editorCommand: null,
        gitUserName: null,
        gitUserEmail: null,
        branchTemplate: "{prefix}/{ticketKey}-{slug}",
        ghPrTitleTemplate: null,
        ghPrBodyTemplate: null,
        ghAutolinkTickets: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })),
    patchAppSettings: vi.fn(),
}));

vi.mock("@/api/editors", () => ({
    getEditors: vi.fn(async () => [
        { key: "VS_CODE", label: "VS Code", installed: true },
    ]),
}));

vi.mock("@/api/projects", () => ({
    getProjectSettings: vi.fn(async () => ({
        projectId: "proj-1",
        boardId: "proj-1",
        baseBranch: "main",
        preferredRemote: "origin",
        setupScript: null,
        devScript: null,
        cleanupScript: null,
        copyFiles: null,
        defaultAgent: "AGENT",
        defaultProfileId: null,
        autoCommitOnFinish: false,
        autoPushOnAutocommit: false,
        ticketPrefix: "PRJ",
        nextTicketNumber: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProjectName: vi.fn(),
    deleteProjectById: vi.fn(),
    updateProjectSettings: vi.fn(),
    listProjectBranches: vi.fn(),
    getNextTicketKey: vi.fn(),
    getProjectGithubOrigin: vi.fn(),
    importGithubIssues: vi.fn(),
    enhanceTicketRequest: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
    toast: vi.fn(),
}));

function TestInspector(props: { projectId: string; card: Card }) {
    const state = useCardInspectorState({
        projectId: props.projectId,
        card: props.card,
        onUpdate: async () => {},
        onDelete: async () => {},
    });

    return (
        <div>
            <div data-testid="attempt-id">
                {state.attempt.attempt?.id ?? ""}
            </div>
            <div data-testid="attempt-status">
                {state.attempt.attempt?.status ?? ""}
            </div>
        </div>
    );
}

describe("useCardInspectorState – auto-start attempt subscription", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        attemptDetailRef.current = null;
    });

    it("subscribes to a newly started attempt when attempt_started is emitted", async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

        const card: Card = {
            id: "card-1",
            title: "Test card",
            description: "",
            dependsOn: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        render(
            <QueryClientProvider client={queryClient}>
                <TestInspector projectId="proj-1" card={card} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(getAttemptDetailForCardMock).toHaveBeenCalled();
        });

        expect(
            screen.getByTestId("attempt-id").textContent,
        ).toBe("");

        const now = new Date().toISOString();
        attemptDetailRef.current = {
            attempt: {
                id: "att-1",
                boardId: "proj-1",
                cardId: "card-1",
                agent: "AGENT",
                status: "running",
                baseBranch: "main",
                branchName: "feature/test",
                worktreePath: "/tmp",
                createdAt: now,
                updatedAt: now,
                startedAt: now,
                endedAt: null,
                sessionId: null,
            },
            logs: [],
            conversation: [],
        };

        await act(async () => {
            eventBus.emit("attempt_started", {
                attemptId: "att-1",
                cardId: "card-1",
            });
        });

        await waitFor(() => {
            expect(
                screen.getByTestId("attempt-id").textContent,
            ).toBe("att-1");
        });

        expect(getAttemptDetailForCardMock.mock.calls.length).toBeGreaterThan(1);
    });
});
