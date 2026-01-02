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

vi.mock("@/components/ui/sheet", () => ({
    Sheet: ({ children, open }: any) => open ? <div data-testid="sheet">{children}</div> : null,
    SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
    SheetHeader: ({ children }: any) => <div>{children}</div>,
    SheetTitle: ({ children }: any) => <div>{children}</div>,
}));

let mockInspectorState: UseCardInspectorStateResult;

vi.mock("@/components/kanban/card-inspector/InspectorHeader", () => ({
    InspectorHeader: ({ actions, viewMode, onViewModeChange, hasAttempt }: any) => (
        <div data-testid="inspector-header">
            InspectorHeader
            {actions}
            {viewMode && onViewModeChange && (
                <div data-testid="view-mode-toggle">
                    <button 
                        data-testid="chat-view-btn"
                        data-active={viewMode === 'conversation'}
                        onClick={() => onViewModeChange('conversation')}
                    >
                        {hasAttempt ? 'Chat' : 'Start'}
                    </button>
                    <button 
                        data-testid="details-view-btn"
                        data-active={viewMode === 'details'}
                        onClick={() => onViewModeChange('details')}
                    >
                        Details
                    </button>
                </div>
            )}
        </div>
    ),
}));

vi.mock("@/components/kanban/card-inspector/TicketDetailsPanel", () => ({
    TicketDetailsPanel: () => (
        <div data-testid="ticket-details-panel">
            TicketDetailsPanel
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
        onOpenProcesses,
        onOpenLogs,
    }: any) =>
        attempt ? (
            <div data-testid="attempt-toolbar">
                <button type="button" onClick={onOpenEditor}>Open editor</button>
                <button type="button" onClick={onOpenChanges}>Changes</button>
                <button type="button" onClick={onOpenCommit}>Commit…</button>
                <button type="button" onClick={onOpenPr}>PR…</button>
                <button type="button" onClick={onOpenMerge}>Merge</button>
                {onOpenProcesses && <button type="button" onClick={onOpenProcesses}>Processes</button>}
                {onOpenLogs && <button type="button" onClick={onOpenLogs}>Logs</button>}
            </div>
        ) : null,
}));

vi.mock("@/components/kanban/card-inspector/AttemptCreateForm", () => ({
    AttemptCreateForm: () => <div data-testid="attempt-create-form">AttemptCreateForm</div>,
}));

vi.mock("@/components/kanban/card-inspector/sections/AttemptsSection", () => ({
    AttemptsSection: () => <div data-testid="attempts-section">AttemptsSection</div>,
}));

vi.mock("@/components/kanban/card-inspector/sections/ActivitySection", () => ({
    ActivitySection: ({ onViewLogs }: { onViewLogs: () => void }) => (
        <div data-testid="activity-section">
            <button type="button" onClick={onViewLogs}>
                View logs
            </button>
        </div>
    ),
}));

vi.mock("@/components/kanban/card-inspector/LogsPane", () => ({
    LogsPane: () => <div data-testid="logs-pane">LogsPane</div>,
}));

vi.mock("@/lib/ticketTypes", () => ({
    getTicketTypeColor: () => "transparent",
}));

const baseCard: Card = {
    id: "card-1",
    title: "Sample Card",
    description: "",
    dependsOn: [],
    ticketKey: "CARD-1",
    isEnhanced: false,
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
        values: { title: baseCard.title, description: baseCard.description ?? "", dependsOn: baseCard.dependsOn ?? [], ticketType: null },
        setValues: vi.fn(),
        saving: false,
        deleting: false,
        handleSave: vi.fn(),
        handleDelete: vi.fn(),
        existingImages: [],
        imagesLoading: false,
        pendingImages: [],
        addImages: vi.fn(),
        removeImage: vi.fn(),
        clearImages: vi.fn(),
        canAddMoreImages: true,
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
        pendingImages: [],
        addImages: vi.fn(),
        removeImage: vi.fn(),
        clearImages: vi.fn(),
        canAddMoreImages: true,
        startAttempt: vi.fn(),
        retryAttempt: vi.fn(),
        starting: false,
        retrying: false,
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

describe("CardInspector – view mode toggle and side sheets", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        mocks.gitSectionProps.length = 0;
        mockInspectorState = createInspectorState();
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);
    });

    it("shows conversation view by default when an attempt exists", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        await waitFor(() => {
            expect(screen.getByTestId("attempts-section")).not.toBeNull();
        });
    });

    it("shows create form when no attempt exists in conversation view", async () => {
        mockInspectorState = createInspectorState();
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        await waitFor(() => {
            expect(screen.getByTestId("attempt-create-form")).not.toBeNull();
        });
    });

    it("renders attempt actions in the header whenever an attempt exists", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        expect(screen.getByTestId("attempt-toolbar")).not.toBeNull();
    });

    it("does not show header attempt actions when no attempt exists", () => {
        renderInspector();

        expect(screen.queryByTestId("attempt-toolbar")).toBeNull();
    });

    it("opens git dialogs from header actions", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        fireEvent.click(screen.getByRole("button", { name: "Changes" }));
        expect(mockInspectorState.git.setChangesOpen).toHaveBeenCalledWith(true);

        fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
        expect(mockInspectorState.git.handleOpenEditor).toHaveBeenCalled();
    });

    it("keeps git dialog hosts mounted", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        expect(screen.getByTestId("git-section")).not.toBeNull();
        expect(mocks.gitSectionProps.at(-1)?.changesOpen).toBe(false);
    });

    it("can switch between conversation and details views", async () => {
        mockInspectorState = createInspectorState({
            attempt: { ...createInspectorState().attempt, attempt: baseAttempt },
        });
        mocks.useCardInspectorStateMock.mockImplementation(() => mockInspectorState);

        renderInspector();

        const detailsBtn = screen.getByTestId("details-view-btn");
        fireEvent.click(detailsBtn);

        await waitFor(() => {
            expect(screen.getByTestId("ticket-details-panel")).not.toBeNull();
        });
    });
});
