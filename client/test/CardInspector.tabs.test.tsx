import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { Attempt, Card } from "shared";

import { CardInspector } from "@/components/kanban/CardInspector";
import type { UseCardInspectorStateResult } from "@/components/kanban/card-inspector/useCardInspectorState";

const mocks = vi.hoisted(() => ({
    useCardInspectorStateMock: vi.fn(),
}));

vi.mock("@/components/kanban/card-inspector/useCardInspectorState", () => ({
    useCardInspectorState: mocks.useCardInspectorStateMock,
}));

vi.mock("@/components/ui/tabs", () => {
    const React = require("react");

    const TabsContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void }>({});

    const Tabs = ({ value, onValueChange, children, className, ...props }: any) => (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div data-slot="tabs" className={className} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );

    const TabsList = ({ children, className, ...props }: any) => (
        <div role="tablist" data-slot="tabs-list" className={className} {...props}>
            {children}
        </div>
    );

    const TabsTrigger = ({ value: triggerValue, children, className, ...props }: any) => {
        const ctx = React.useContext(TabsContext);
        const active = ctx.value === triggerValue;
        return (
            <button
                role="tab"
                data-slot="tabs-trigger"
                data-state={active ? "active" : "inactive"}
                aria-selected={active}
                className={className}
                onClick={() => ctx.onValueChange?.(triggerValue)}
                {...props}
            >
                {children}
            </button>
        );
    };

    const TabsContent = ({ value: contentValue, children, className, ...props }: any) => {
        const ctx = React.useContext(TabsContext);
        const active = ctx.value === contentValue;
        return active ? (
            <div role="tabpanel" data-slot="tabs-content" data-state="active" className={className} {...props}>
                {children}
            </div>
        ) : (
            <div data-slot="tabs-content" data-state="inactive" hidden className={className} {...props} />
        );
    };

    return { Tabs, TabsList, TabsTrigger, TabsContent };
});

let mockInspectorState: UseCardInspectorStateResult;

vi.mock("@/components/kanban/card-inspector/InspectorHeader", () => ({
    InspectorHeader: () => <div data-testid="inspector-header">InspectorHeader</div>,
}));

vi.mock("@/components/kanban/card-inspector/sections/DetailsSection", () => ({
    DetailsSection: ({ gitSection }: { gitSection?: React.ReactNode }) => (
        <div data-testid="details-section">
            DetailsSection
            {gitSection}
        </div>
    ),
}));

vi.mock("@/components/kanban/card-inspector/sections/GitSection", () => ({
    GitSection: () => <div data-testid="git-section">GitSection</div>,
}));

vi.mock("@/components/kanban/card-inspector/AttemptCreateForm", () => ({
    AttemptCreateForm: () => <div>AttemptCreateForm</div>,
}));

vi.mock("@/components/kanban/card-inspector/sections/AttemptsSection", () => ({
    AttemptsSection: () => <div>AttemptsSection</div>,
}));

vi.mock("@/components/kanban/card-inspector/sections/ActivitySection", () => ({
    ActivitySection: ({ onViewLogs }: { onViewLogs: () => void }) => (
        <button type="button" onClick={onViewLogs}>
            View logs
        </button>
    ),
}));

vi.mock("@/components/kanban/card-inspector/LogsPane", () => ({
    LogsPane: () => <div>LogsPane</div>,
}));

const baseCard: Card = {
    id: "card-1",
    title: "Sample Card",
    description: "",
    dependsOn: [],
    ticketKey: "CARD-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const baseAttempt: Attempt = {
    id: "att-1",
    cardId: "card-1",
    boardId: "board-1",
    agent: "agent-1",
    status: "running",
    baseBranch: "main",
    branchName: "feature/card-1",
    worktreePath: "/tmp",
    sessionId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const createInspectorState = (
    overrides: Partial<UseCardInspectorStateResult> = {},
): UseCardInspectorStateResult => {
    const baseDetails = {
        values: { title: baseCard.title, description: baseCard.description ?? "", dependsOn: baseCard.dependsOn ?? [] },
        setValues: vi.fn(),
        saving: false,
        deleting: false,
        handleSave: vi.fn(),
        handleDelete: vi.fn(),
    };

    const baseHeader = {
        copied: false,
        handleCopyTicketKey: vi.fn(),
    };

    const baseAttemptState = {
        attempt: null,
        logs: [],
        conversation: [],
        agent: "agent-1",
        agents: [{ key: "agent-1", label: "Agent 1" }],
        availableProfiles: [],
        profileId: undefined as string | undefined,
        attemptAgent: undefined as string | undefined,
        followupProfiles: [],
        followup: "",
        setFollowup: vi.fn(),
        sendFollowup: vi.fn(),
        sendFollowupPending: false,
        startAttempt: vi.fn(),
        starting: false,
        stopAttempt: vi.fn(),
        stopping: false,
        handleAgentSelect: vi.fn(),
        handleProfileSelect: vi.fn(),
    };

    const baseGit = {
        openButtonDisabledReason: null as string | null,
        handleOpenEditor: vi.fn(),
        changesOpen: false,
        setChangesOpen: vi.fn(),
        commitOpen: false,
        setCommitOpen: vi.fn(),
        prOpen: false,
        setPrOpen: vi.fn(),
        mergeOpen: false,
        setMergeOpen: vi.fn(),
        prDefaults: { title: "", body: "" },
        todoSummary: null,
    };

    const baseActivity = {
        devScriptConfigured: false,
        latestDevAutomation: null,
        devAutomationPending: false,
        runDevScript: vi.fn(),
    };

    return {
        details: { ...baseDetails, ...(overrides.details ?? {}) },
        header: { ...baseHeader, ...(overrides.header ?? {}) },
        attempt: { ...baseAttemptState, ...(overrides.attempt ?? {}) },
        git: { ...baseGit, ...(overrides.git ?? {}) },
        activity: { ...baseActivity, ...(overrides.activity ?? {}) },
    } satisfies UseCardInspectorStateResult;
};

const renderInspector = (card: Card = baseCard) =>
    render(
        <CardInspector
            projectId="proj-1"
            card={card}
            onUpdate={async () => {}}
            onDelete={async () => {}}
        />,
    );

describe("CardInspector – top-level Ticket/Attempts tabs", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        mockInspectorState = createInspectorState();
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);
    });

    it("shows Ticket tab by default and isolates ticket details", async () => {
        renderInspector();

        const ticketTab = screen.getByRole("tab", { name: /Ticket/i });
        const attemptsTab = screen.getByRole("tab", { name: /Attempts/i });

        expect(ticketTab.getAttribute("data-state")).toBe("active");
        expect(attemptsTab.getAttribute("data-state")).toBe("inactive");

        expect(screen.getByTestId("details-section")).not.toBeNull();
        expect(screen.queryByText("AttemptCreateForm")).toBeNull();

        fireEvent.click(attemptsTab);

        await waitFor(() => expect(attemptsTab.getAttribute("data-state")).toBe("active"));

        expect(screen.getByText("AttemptCreateForm")).not.toBeNull();
        expect(screen.queryByTestId("details-section")).toBeNull();
    });

    it("resets to Ticket tab and messages inner tab when switching cards", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });

        const { rerender } = renderInspector();

        const attemptsTab = screen.getByRole("tab", { name: /Attempts/i });
        fireEvent.click(attemptsTab);

        await waitFor(() => expect(attemptsTab.getAttribute("data-state")).toBe("active"));

        fireEvent.click(screen.getByRole("tab", { name: /Processes/i }));

        const nextCard: Card = {
            ...baseCard,
            id: "card-2",
            title: "Next Card",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: { ...baseAttempt, id: "att-2", cardId: "card-2" } },
        });

        rerender(
            <CardInspector
                projectId="proj-1"
                card={nextCard}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole("tab", { name: /Ticket/i }).getAttribute("data-state")).toBe("active");
        });

        fireEvent.click(screen.getByRole("tab", { name: /Attempts/i }));

        await waitFor(() =>
            expect(screen.getByRole("tab", { name: /Attempts/i }).getAttribute("data-state")).toBe("active"),
        );

        const messagesTab = screen.getByRole("tab", { name: /Messages/i });
        expect(messagesTab.getAttribute("data-state")).toBe("active");
    });

    it("View logs switches only the inner attempt tab", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });

        renderInspector();

        fireEvent.click(screen.getByRole("tab", { name: /Attempts/i }));

        await waitFor(() =>
            expect(screen.getByRole("tab", { name: /Attempts/i }).getAttribute("data-state")).toBe("active"),
        );

        fireEvent.click(screen.getByRole("tab", { name: /Processes/i }));

        const logsTab = screen.getByRole("tab", { name: /Logs/i });
        expect(logsTab.getAttribute("data-state")).toBe("inactive");

        fireEvent.click(screen.getByRole("button", { name: /View logs/i }));

        expect(screen.getByRole("tab", { name: /Attempts/i }).getAttribute("data-state")).toBe("active");
        expect(logsTab.getAttribute("data-state")).toBe("active");
    });
});
