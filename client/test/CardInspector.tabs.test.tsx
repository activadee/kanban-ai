import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { Attempt, Card } from "shared";

import { CardInspector } from "@/components/kanban/CardInspector";
import type { UseCardInspectorStateResult } from "@/components/kanban/card-inspector/useCardInspectorState";

const mocks = vi.hoisted(() => ({
    useCardInspectorStateMock: vi.fn(),
    gitSectionProps: [] as any[],
}));

vi.mock("@/components/kanban/card-inspector/useCardInspectorState", () => ({
    useCardInspectorState: mocks.useCardInspectorStateMock,
}));

vi.mock("@/components/ui/tabs", () => {
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
    InspectorHeader: ({ actions }: { actions?: React.ReactNode }) => (
        <div data-testid="inspector-header">
            InspectorHeader
            {actions}
        </div>
    ),
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
    GitSection: (props: any) => {
        mocks.gitSectionProps.push(props);
        return <div data-testid="git-section">GitSection</div>;
    },
}));

vi.mock("@/components/kanban/card-inspector/AttemptToolbar", () => ({
    AttemptToolbar: ({
                         attempt,
                         onOpenEditor,
                         onOpenChanges,
                         onOpenCommit,
                         onOpenPr,
                         onOpenMerge,
                     }: any) =>
        attempt ? (
            <div data-testid="attempt-toolbar">
                <button type="button" onClick={onOpenEditor}>Open editor</button>
                <button type="button" onClick={onOpenChanges}>Changes</button>
                <button type="button" onClick={onOpenCommit}>Commit…</button>
                <button type="button" onClick={onOpenPr}>PR…</button>
                <button type="button" onClick={onOpenMerge}>Merge</button>
            </div>
        ) : null,
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
        mocks.gitSectionProps.length = 0;
        mockInspectorState = createInspectorState();
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);
    });

    it("shows Ticket tab by default when no attempt exists and isolates ticket details", async () => {
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

    it("shows Attempts tab by default when an attempt exists", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        const ticketTab = screen.getByRole("tab", { name: /Ticket/i });
        const attemptsTab = screen.getByRole("tab", { name: /Attempts/i });

        await waitFor(() => {
            expect(attemptsTab.getAttribute("data-state")).toBe("active");
            expect(ticketTab.getAttribute("data-state")).toBe("inactive");
        });

        expect(screen.getByText("AttemptsSection")).not.toBeNull();
        expect(screen.queryByText("AttemptCreateForm")).toBeNull();
    });

    it("switches to Attempts after attempt data loads for the current card", async () => {
        mockInspectorState = createInspectorState();
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        const { rerender } = renderInspector();

        const ticketTab = screen.getByRole("tab", { name: /Ticket/i });
        const attemptsTab = screen.getByRole("tab", { name: /Attempts/i });

        expect(ticketTab.getAttribute("data-state")).toBe("active");
        expect(attemptsTab.getAttribute("data-state")).toBe("inactive");

        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        rerender(
            <CardInspector
                projectId="proj-1"
                card={baseCard}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );

        await waitFor(() => {
            expect(attemptsTab.getAttribute("data-state")).toBe("active");
            expect(ticketTab.getAttribute("data-state")).toBe("inactive");
        });
    });

    it("recalculates top-level tab when switching to a card without an attempt", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        const { rerender } = renderInspector();

        const ticketTab = screen.getByRole("tab", { name: /Ticket/i });
        const attemptsTab = screen.getByRole("tab", { name: /Attempts/i });

        // Move away from the default to ensure reset happens.
        fireEvent.click(ticketTab);

        await waitFor(() => expect(ticketTab.getAttribute("data-state")).toBe("active"));

        const nextCard: Card = {
            ...baseCard,
            id: "card-2",
            title: "Next Card",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        mockInspectorState = createInspectorState();
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        rerender(
            <CardInspector
                projectId="proj-1"
                card={nextCard}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );

        await waitFor(() => {
            expect(ticketTab.getAttribute("data-state")).toBe("active");
            expect(attemptsTab.getAttribute("data-state")).toBe("inactive");
        });
    });

    it("defaults to Attempts tab with inner Messages tab when switching to a card with an attempt", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        const { rerender } = renderInspector();

        const attemptsTab = screen.getByRole("tab", { name: /Attempts/i });
        fireEvent.click(screen.getByRole("tab", { name: /Processes/i }));

        await waitFor(() => expect(screen.getByRole("tab", { name: /Processes/i }).getAttribute("data-state")).toBe("active"));

        fireEvent.click(screen.getByRole("tab", { name: /Ticket/i }));
        await waitFor(() => expect(screen.getByRole("tab", { name: /Ticket/i }).getAttribute("data-state")).toBe("active"));

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
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        rerender(
            <CardInspector
                projectId="proj-1"
                card={nextCard}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole("tab", { name: /Attempts/i }).getAttribute("data-state")).toBe("active");
        });

        const messagesTab = screen.getByRole("tab", { name: /Messages/i });
        expect(messagesTab.getAttribute("data-state")).toBe("active");
    });

    it("does not keep Attempts active when switching to a card without an attempt even if previous attempt lingers", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        const { rerender } = renderInspector();

        const ticketTab = screen.getByRole("tab", { name: /Ticket/i });
        const attemptsTab = screen.getByRole("tab", { name: /Attempts/i });

        await waitFor(() => expect(attemptsTab.getAttribute("data-state")).toBe("active"));

        const nextCard: Card = {
            ...baseCard,
            id: "card-2",
            title: "Next Card",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Simulate stale attempt data that still references the old card.
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: { ...baseAttempt, cardId: "card-1" } },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        rerender(
            <CardInspector
                projectId="proj-1"
                card={nextCard}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );

        await waitFor(() => {
            expect(ticketTab.getAttribute("data-state")).toBe("active");
            expect(attemptsTab.getAttribute("data-state")).toBe("inactive");
        });
    });

    it("renders attempt actions in the header whenever an attempt exists", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        expect(screen.getByTestId("attempt-toolbar")).not.toBeNull();

        // Switch tabs to ensure header actions persist.
        fireEvent.click(screen.getByRole("tab", { name: /Ticket/i }));
        await waitFor(() => expect(screen.getByRole("tab", { name: /Ticket/i }).getAttribute("data-state")).toBe("active"));

        expect(screen.getByTestId("attempt-toolbar")).not.toBeNull();
    });

    it("does not show header attempt actions when no attempt exists", () => {
        renderInspector();

        expect(screen.queryByTestId("attempt-toolbar")).toBeNull();
    });

    it("opens git dialogs from header actions even on the Attempts tab", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        await waitFor(() => expect(screen.getByRole("tab", { name: /Attempts/i }).getAttribute("data-state")).toBe("active"));

        fireEvent.click(screen.getByRole("button", { name: "Changes" }));
        expect(mockInspectorState.git.setChangesOpen).toHaveBeenCalledWith(true);

        fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
        expect(mockInspectorState.git.handleOpenEditor).toHaveBeenCalled();
    });

    it("keeps git dialog hosts mounted regardless of active tab", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        expect(screen.getByTestId("git-section")).not.toBeNull();
        expect(mocks.gitSectionProps.at(-1)?.changesOpen).toBe(false);

        fireEvent.click(screen.getByRole("tab", { name: /Ticket/i }));
        await waitFor(() =>
            expect(screen.getByRole("tab", { name: /Ticket/i }).getAttribute("data-state")).toBe("active"),
        );

        fireEvent.click(screen.getByRole("tab", { name: /Attempts/i }));
        await waitFor(() =>
            expect(screen.getByRole("tab", { name: /Attempts/i }).getAttribute("data-state")).toBe("active"),
        );

        expect(screen.getByTestId("git-section")).not.toBeNull();
        expect(mocks.gitSectionProps.at(-1)?.changesOpen).toBe(false);
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
