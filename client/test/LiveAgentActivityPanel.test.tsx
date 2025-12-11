import React from "react";
import {describe, it, expect, beforeEach, vi} from "vitest";
import {render, screen, fireEvent, within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import type {
    ActiveAttemptSummary,
    AgentSummary,
    AttemptActivityItem,
} from "shared";
import {LiveAgentActivityPanel} from "@/pages/dashboard/LiveAgentActivityPanel";

vi.mock("@/components/ui/select", () => {
    const ReactModule = require("react") as typeof React;

    type SelectContextValue = {
        value?: string;
        onChange?: (value: string) => void;
    };

    const SelectContext = ReactModule.createContext<SelectContextValue>({});

    type SelectProps = {
        value?: string;
        onValueChange?: (value: string) => void;
        children?: React.ReactNode;
    };

    const Select: React.FC<SelectProps> = ({value, onValueChange, children}) => (
        <SelectContext.Provider value={{value, onChange: onValueChange}}>
            <div data-slot="select">{children}</div>
        </SelectContext.Provider>
    );

    type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
        children?: React.ReactNode;
    };

    const SelectTrigger: React.FC<TriggerProps> = ({children, ...props}) => (
        <button type="button" data-slot="select-trigger" {...props}>
            {children}
        </button>
    );

    const SelectValue: React.FC<{placeholder?: string}> = ({placeholder}) => (
        <span>{placeholder}</span>
    );

    const SelectContent: React.FC<{children?: React.ReactNode}> = ({children}) => (
        <div data-slot="select-content">{children}</div>
    );

    type ItemProps = {
        value: string;
        children?: React.ReactNode;
    };

    const SelectItem: React.FC<ItemProps> = ({value, children}) => {
        const ctx = ReactModule.useContext(SelectContext);
        const selected = ctx.value === value;
        return (
            <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => ctx.onChange?.(value)}
            >
                {children}
            </button>
        );
    };

    return {Select, SelectTrigger, SelectValue, SelectContent, SelectItem};
});

function createActiveAttempt(overrides: Partial<ActiveAttemptSummary> = {}): ActiveAttemptSummary {
    const now = new Date().toISOString();
    return {
        attemptId: "attempt-1",
        projectId: "project-1",
        projectName: "Project One",
        cardId: "card-1",
        cardTitle: "Implement feature",
        ticketKey: "ABC-1",
        agentId: "AGENT",
        status: "running",
        startedAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function createActivity(overrides: Partial<AttemptActivityItem> = {}): AttemptActivityItem {
    const now = new Date().toISOString();
    return {
        attemptId: "attempt-activity-1",
        projectId: "project-1",
        projectName: "Project One",
        cardId: "card-1",
        cardTitle: "Implement feature",
        ticketKey: "ABC-1",
        agentId: "AGENT",
        status: "succeeded",
        occurredAt: now,
        ...overrides,
    };
}

const agents: AgentSummary[] = [
    {key: "AGENT", label: "Fixture Agent"},
    {key: "IDLE", label: "Idle Agent"},
];

const noopTimeLabel = () => "1m ago";

describe("LiveAgentActivityPanel – filtering", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("filters active attempts by agent, status, and project", () => {
        const attempts: ActiveAttemptSummary[] = [
            createActiveAttempt({
                attemptId: "a1",
                agentId: "AGENT",
                status: "running",
                projectId: "project-1",
                projectName: "Project One",
            }),
            createActiveAttempt({
                attemptId: "a2",
                agentId: "AGENT",
                status: "queued",
                projectId: "project-2",
                projectName: "Project Two",
            }),
            createActiveAttempt({
                attemptId: "a3",
                agentId: "IDLE",
                status: "queued",
                projectId: "project-1",
                projectName: "Project One",
            }),
        ];

        render(
            <MemoryRouter>
                <LiveAgentActivityPanel
                    activeAttempts={attempts}
                    recentActivity={[]}
                    agents={agents}
                    isLoading={false}
                    timeRangeLabel="Last 7 days"
                    updatedLabel={noopTimeLabel}
                    streamStatus="open"
                    hasError={false}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        const list = screen.getByTestId("active-attempts-list");
        expect(within(list).getAllByTestId("active-attempt-row").length).toBe(3);

        // Filter by agent "Fixture Agent" (AGENT).
        const agentOption = screen.getByRole("option", {name: /Fixture Agent/i});
        fireEvent.click(agentOption);

        expect(within(list).getAllByTestId("active-attempt-row").length).toBe(2);
        expect(within(list).queryByText(/Idle Agent/i)).toBeNull();

        // Further filter by status "Running".
        const statusOption = screen.getByRole("option", {name: /Running/i});
        fireEvent.click(statusOption);

        const rowsAfterStatus = within(list).getAllByTestId("active-attempt-row");
        expect(rowsAfterStatus.length).toBe(1);
        expect(within(rowsAfterStatus[0]).getByText(/Running/i)).toBeTruthy();

        // Finally, filter by project "Project Two".
        const projectOption = screen.getByRole("option", {name: /Project Two/i});
        fireEvent.click(projectOption);

        // No combination matches all three filters.
        expect(screen.getByText(/No active attempts match the current filters/i)).toBeTruthy();
    });

    it("persists filters across updates to the active attempts list", () => {
        const initialAttempts: ActiveAttemptSummary[] = [
            createActiveAttempt({
                attemptId: "a1",
                agentId: "AGENT",
                status: "running",
            }),
        ];

        const updatedAttempts: ActiveAttemptSummary[] = [
            ...initialAttempts,
            createActiveAttempt({
                attemptId: "a2",
                agentId: "AGENT",
                status: "queued",
            }),
        ];

        const {rerender} = render(
            <MemoryRouter>
                <LiveAgentActivityPanel
                    activeAttempts={initialAttempts}
                    recentActivity={[]}
                    agents={agents}
                    isLoading={false}
                    timeRangeLabel="Last 7 days"
                    updatedLabel={noopTimeLabel}
                    streamStatus="open"
                    hasError={false}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        const queuedOption = screen.getByRole("option", {name: /Queued/i});
        fireEvent.click(queuedOption);

        expect(screen.getByText(/No active attempts match the current filters/i)).toBeTruthy();

        rerender(
            <MemoryRouter>
                <LiveAgentActivityPanel
                    activeAttempts={updatedAttempts}
                    recentActivity={[]}
                    agents={agents}
                    isLoading={false}
                    timeRangeLabel="Last 7 days"
                    updatedLabel={noopTimeLabel}
                    streamStatus="open"
                    hasError={false}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        const list = screen.getByTestId("active-attempts-list");
        const rows = within(list).getAllByTestId("active-attempt-row");
        expect(rows.length).toBe(1);
        expect(within(rows[0]).getByText(/Queued/i)).toBeTruthy();
    });
});

describe("LiveAgentActivityPanel – navigation and websocket states", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("invokes onAttemptNavigate when a row is clicked or activated via keyboard", () => {
        const attempts: ActiveAttemptSummary[] = [
            createActiveAttempt({attemptId: "a1"}),
        ];
        const onNavigate = vi.fn();

        render(
            <MemoryRouter>
                <LiveAgentActivityPanel
                    activeAttempts={attempts}
                    recentActivity={[]}
                    agents={agents}
                    isLoading={false}
                    timeRangeLabel="Last 7 days"
                    updatedLabel={noopTimeLabel}
                    streamStatus="open"
                    hasError={false}
                    onRetry={() => undefined}
                    onAttemptNavigate={onNavigate}
                />
            </MemoryRouter>,
        );

        const row = screen.getByTestId("active-attempt-row");
        fireEvent.click(row);
        expect(onNavigate).toHaveBeenCalledWith("a1");

        onNavigate.mockClear();
        row.focus();
        fireEvent.keyDown(row, {key: "Enter", code: "Enter"});
        expect(onNavigate).toHaveBeenCalledWith("a1");
    });

    it("renders websocket warning when streamStatus indicates an issue", () => {
        const attempts: ActiveAttemptSummary[] = [createActiveAttempt()];

        render(
            <MemoryRouter>
                <LiveAgentActivityPanel
                    activeAttempts={attempts}
                    recentActivity={[createActivity()]}
                    agents={agents}
                    isLoading={false}
                    timeRangeLabel="Last 7 days"
                    updatedLabel={noopTimeLabel}
                    streamStatus="error"
                    hasError={false}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        expect(
            screen.getByText(/Live updates temporarily unavailable\. Showing latest known data\./i),
        ).toBeTruthy();

        const recentList = screen.getByTestId("recent-activity-list");
        expect(within(recentList).getAllByRole("listitem").length).toBe(1);
    });

    it("renders deep links for recent activity items", () => {
        const activity = createActivity({
            attemptId: "attempt-activity-42",
            projectId: "project-42",
            cardId: "card-42",
        });

        render(
            <MemoryRouter>
                <LiveAgentActivityPanel
                    activeAttempts={[]}
                    recentActivity={[activity]}
                    agents={agents}
                    isLoading={false}
                    timeRangeLabel="Last 7 days"
                    updatedLabel={noopTimeLabel}
                    streamStatus="open"
                    hasError={false}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        const list = screen.getByTestId("recent-activity-list");
        const viewAttemptLink = within(list)
            .getByText("View attempt")
            .closest("a");
        expect(viewAttemptLink).not.toBeNull();
        expect(viewAttemptLink?.getAttribute("href")).toBe(
            "/attempts/attempt-activity-42",
        );

        const viewBoardLink = within(list)
            .getByText("View board")
            .closest("a");
        expect(viewBoardLink).not.toBeNull();
        expect(viewBoardLink?.getAttribute("href")).toBe(
            "/projects/project-42?cardId=card-42",
        );
    });

    it("renders a non-blocking error banner with retry when loading fails", () => {
        const onRetry = vi.fn();

        render(
            <MemoryRouter>
                <LiveAgentActivityPanel
                    activeAttempts={[]}
                    recentActivity={[]}
                    agents={agents}
                    isLoading={false}
                    timeRangeLabel="Last 7 days"
                    updatedLabel={noopTimeLabel}
                    streamStatus="open"
                    hasError
                    onRetry={onRetry}
                />
            </MemoryRouter>,
        );

        expect(
            screen.getByText(/Unable to load live agent activity/i),
        ).toBeTruthy();

        const retryButton = screen.getByRole("button", {name: /Retry/i});
        fireEvent.click(retryButton);
        expect(onRetry).toHaveBeenCalledTimes(1);

        // When in an error state, we avoid showing the generic "no active attempts" empty copy.
        expect(
            screen.queryByText(/No active attempts right now/i),
        ).toBeNull();
    });
});
