import React from "react";
import {describe, it, expect, beforeEach} from "vitest";
import {render, screen, fireEvent, within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import type {AttemptActivityItem} from "shared";
import {RecentAttemptHistoryPanel} from "@/pages/dashboard/RecentAttemptHistoryPanel";

function createActivity(overrides: Partial<AttemptActivityItem> = {}): AttemptActivityItem {
    const now = new Date().toISOString();
    return {
        attemptId: "attempt-1",
        projectId: "project-1",
        projectName: "Project One",
        cardId: "card-1",
        cardTitle: "Implement feature",
        ticketKey: "ABC-1",
        agentId: "AGENT",
        status: "succeeded",
        occurredAt: now,
        durationSeconds: 75,
        ...overrides,
    };
}

const noopRelativeTime = () => "1m ago";

describe("RecentAttemptHistoryPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders loading skeletons while data is loading", () => {
        render(
            <MemoryRouter>
                <RecentAttemptHistoryPanel
                    attempts={[]}
                    isLoading
                    hasError={false}
                    timeRangeLabel="Last 7 days"
                    formatRelativeTime={noopRelativeTime}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        expect(
            screen.getByTestId("recent-attempt-history-skeleton"),
        ).toBeTruthy();
    });

    it("renders empty state when there are no attempts", () => {
        render(
            <MemoryRouter>
                <RecentAttemptHistoryPanel
                    attempts={[]}
                    isLoading={false}
                    hasError={false}
                    timeRangeLabel="Last 7 days"
                    formatRelativeTime={noopRelativeTime}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        expect(
            screen.getByText(/No recent attempts yet/i),
        ).toBeTruthy();
    });

    it("renders a list of recent attempts with status, ticket, agent, duration, and timestamps", () => {
        const attempts: AttemptActivityItem[] = [
            createActivity({
                attemptId: "a-1",
                durationSeconds: 75,
            }),
            createActivity({
                attemptId: "a-2",
                status: "failed",
                durationSeconds: 3600,
            }),
        ];

        render(
            <MemoryRouter>
                <RecentAttemptHistoryPanel
                    attempts={attempts}
                    isLoading={false}
                    hasError={false}
                    timeRangeLabel="Last 7 days"
                    formatRelativeTime={noopRelativeTime}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        const list = screen.getByTestId("recent-attempt-history-list");
        const rows = within(list).getAllByTestId("recent-attempt-history-row");
        expect(rows.length).toBe(2);

        // Status badges and ticket titles.
        expect(screen.getByText(/Succeeded/i)).toBeTruthy();
        expect(screen.getByText(/Failed/i)).toBeTruthy();
        expect(screen.getAllByText(/ABC-1 · Implement feature/i).length).toBeGreaterThan(0);

        // Agent label.
        expect(screen.getAllByText(/AGENT/i).length).toBeGreaterThan(0);

        // Duration formatting: 75s -> "1m 15s", 3600s -> "1h".
        expect(screen.getByText(/Duration 1m 15s/i)).toBeTruthy();
        expect(screen.getByText(/Duration 1h/i)).toBeTruthy();
    });

    it("invokes navigation callback when a row is clicked or activated via keyboard", () => {
        const attempts: AttemptActivityItem[] = [createActivity({attemptId: "a-1"})];
        const onNavigate = vi.fn();

        render(
            <MemoryRouter>
                <RecentAttemptHistoryPanel
                    attempts={attempts}
                    isLoading={false}
                    hasError={false}
                    timeRangeLabel="Last 7 days"
                    formatRelativeTime={noopRelativeTime}
                    onRetry={() => undefined}
                    onAttemptNavigate={onNavigate}
                />
            </MemoryRouter>,
        );

        const list = screen.getByTestId("recent-attempt-history-list");
        const row = within(list).getAllByTestId("recent-attempt-history-row")[0];

        fireEvent.click(row);
        expect(onNavigate).toHaveBeenCalledWith("a-1");

        onNavigate.mockClear();
        row.focus();
        fireEvent.keyDown(row, {key: "Enter", code: "Enter"});
        expect(onNavigate).toHaveBeenCalledWith("a-1");
    });

    it("shows show more / show less controls when attempts exceed one page", () => {
        const attempts: AttemptActivityItem[] = Array.from({length: 15}).map((_, index) =>
            createActivity({attemptId: `a-${index}`}),
        );

        render(
            <MemoryRouter>
                <RecentAttemptHistoryPanel
                    attempts={attempts}
                    isLoading={false}
                    hasError={false}
                    timeRangeLabel="Last 7 days"
                    formatRelativeTime={noopRelativeTime}
                    onRetry={() => undefined}
                />
            </MemoryRouter>,
        );

        const list = screen.getByTestId("recent-attempt-history-list");
        expect(
            within(list).getAllByTestId("recent-attempt-history-row").length,
        ).toBe(10);

        const showMore = screen.getByRole("button", {name: /Show more/i});
        fireEvent.click(showMore);

        expect(
            within(list).getAllByTestId("recent-attempt-history-row").length,
        ).toBe(15);

        const showLess = screen.getByRole("button", {name: /Show less/i});
        fireEvent.click(showLess);

        expect(
            within(list).getAllByTestId("recent-attempt-history-row").length,
        ).toBe(10);
    });

    it("renders an error banner with retry when hasError is true", () => {
        const onRetry = vi.fn();

        render(
            <MemoryRouter>
                <RecentAttemptHistoryPanel
                    attempts={[]}
                    isLoading={false}
                    hasError
                    timeRangeLabel="Last 7 days"
                    formatRelativeTime={noopRelativeTime}
                    onRetry={onRetry}
                />
            </MemoryRouter>,
        );

        expect(
            screen.getByText(/Unable to load recent attempt history/i),
        ).toBeTruthy();

        const retryButton = screen.getByRole("button", {name: /Retry/i});
        fireEvent.click(retryButton);

        expect(onRetry).toHaveBeenCalled();
    });
});
