import React from "react";
import {describe, it, expect, beforeEach, vi} from "vitest";
import {render, cleanup, screen, fireEvent, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import type {DashboardInbox} from "shared";

const attemptsMocks = vi.hoisted(() => ({
    startAttemptRequest: vi.fn(),
}));

vi.mock("@/api/attempts", () => attemptsMocks);

vi.mock("@/components/ui/toast", () => ({
    toast: vi.fn(),
}));

vi.mock("@/components/ui/tabs", () => {
    const TabsContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({});

    const Tabs = ({value, onValueChange, children, className, ...props}: any) => (
        <TabsContext.Provider value={{value, onValueChange}}>
            <div data-slot="tabs" className={className} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );

    const TabsList = ({children, className, ...props}: any) => (
        <div role="tablist" data-slot="tabs-list" className={className} {...props}>
            {children}
        </div>
    );

    const TabsTrigger = ({value: triggerValue, children, className, ...props}: any) => {
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

    const TabsContent = ({value: contentValue, children, className, ...props}: any) => {
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

    return {Tabs, TabsList, TabsTrigger, TabsContent};
});

import {InboxPanel} from "@/pages/dashboard/InboxPanel";
import {toast} from "@/components/ui/toast";

function createInbox(): DashboardInbox {
    const now = new Date().toISOString();
    return {
        review: [
            {
                id: "rev-1",
                type: "review",
                kind: "review",
                attemptId: "attempt-review-1",
                projectId: "proj-1",
                projectName: "Project Alpha",
                cardId: "card-1",
                cardTitle: "Add login flow",
                ticketKey: "ENG-1",
                agentId: "AGENT_REVIEW",
                agentName: "Review Agent",
                status: "succeeded",
                cardStatus: "In Review",
                createdAt: now,
                updatedAt: now,
                finishedAt: now,
                lastUpdatedAt: now,
                prUrl: "https://example.com/pr/1",
                meta: {},
            },
        ],
        failed: [
            {
                id: "fail-1",
                type: "failed",
                kind: "failed",
                attemptId: "attempt-failed-1",
                projectId: "proj-2",
                projectName: "Project Beta",
                cardId: "card-2",
                cardTitle: "Fix failing tests",
                ticketKey: "ENG-2",
                agentId: "AGENT_FAILED",
                agentName: "Failure Agent",
                status: "failed",
                cardStatus: "In Progress",
                createdAt: now,
                updatedAt: now,
                finishedAt: now,
                lastUpdatedAt: now,
                prUrl: null,
                errorSummary: "Tests failed",
                meta: {},
            },
        ],
        stuck: [
            {
                id: "stuck-1",
                type: "stuck",
                kind: "stuck",
                attemptId: "attempt-stuck-1",
                projectId: "proj-3",
                projectName: "Project Gamma",
                cardId: "card-3",
                cardTitle: "Refactor module",
                ticketKey: "ENG-3",
                agentId: "AGENT_STUCK",
                agentName: "Stuck Agent",
                status: "running",
                cardStatus: "Doing",
                createdAt: now,
                updatedAt: now,
                finishedAt: null,
                lastUpdatedAt: now,
                prUrl: null,
                stuckForSeconds: 3600,
                meta: {},
            },
        ],
        meta: {
            totalItems: 3,
            totalReview: 1,
            totalFailed: 1,
            totalStuck: 1,
        },
    };
}

function renderInboxPanel(overrides?: {
    inbox?: DashboardInbox;
    isLoading?: boolean;
    hasError?: boolean;
    onReload?: () => void;
    onAttemptNavigate?: (attemptId: string) => void;
}) {
    const inbox = overrides?.inbox ?? createInbox();
    const isLoading = overrides?.isLoading ?? false;
    const hasError = overrides?.hasError ?? false;
    const onReload = overrides?.onReload ?? vi.fn();
    const onAttemptNavigate = overrides?.onAttemptNavigate ?? vi.fn();

    render(
        <MemoryRouter>
            <InboxPanel
                inbox={inbox}
                isLoading={isLoading}
                hasError={hasError}
                onReload={onReload}
                formatTime={() => "just now"}
                onAttemptNavigate={onAttemptNavigate}
            />
        </MemoryRouter>,
    );

    return {onReload, onAttemptNavigate};
}

describe("Dashboard InboxPanel", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        window.sessionStorage.clear();
    });

    it("renders inbox items grouped by kind with key fields", () => {
        renderInboxPanel();

        expect(screen.getAllByText("Review").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Stuck").length).toBeGreaterThan(0);

        expect(
            screen.getByText((content) => content.includes("Add login flow")),
        ).toBeTruthy();
        expect(screen.getByText("Project Alpha")).toBeTruthy();
        expect(screen.getByText("Review Agent")).toBeTruthy();
    });

    it("filters items by kind using tabs", async () => {
        renderInboxPanel();

        // All filter shows all items.
        expect(screen.getAllByTestId("inbox-row")).toHaveLength(3);

        // Switch to Failed.
        const failedTab = screen.getByRole("tab", {name: /Failed/i});
        fireEvent.click(failedTab);

        let rows = screen.getAllByTestId("inbox-row");
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent ?? "").toContain("Fix failing tests");

        // Switch to Review.
        const reviewTab = screen.getByRole("tab", {name: /Review/i});
        fireEvent.click(reviewTab);

        rows = screen.getAllByTestId("inbox-row");
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent ?? "").toContain("Add login flow");
    });

    it("invokes attempt navigation when a row is clicked", async () => {
        const {onAttemptNavigate} = renderInboxPanel();

        const failedTab = screen.getByRole("tab", {name: /Failed/i});
        fireEvent.click(failedTab);

        const row = screen.getByTestId("inbox-row");
        fireEvent.click(row);

        expect(onAttemptNavigate).toHaveBeenCalledTimes(1);
        expect(onAttemptNavigate).toHaveBeenCalledWith("attempt-failed-1");
    });

    it("renders a PR action when prUrl is present", () => {
        renderInboxPanel();

        const prButton = screen.getByLabelText("Open pull request");
        const link = prButton.closest("a");
        expect(link).not.toBeNull();
        expect(link?.getAttribute("href")).toBe("https://example.com/pr/1");
        expect(link?.getAttribute("target")).toBe("_blank");
    });

    it("retries failed attempts via API and refreshes inbox", async () => {
        const onReload = vi.fn();
        attemptsMocks.startAttemptRequest.mockResolvedValueOnce({} as any);

        renderInboxPanel({onReload});

        const failedTab = screen.getByRole("tab", {name: /Failed/i});
        fireEvent.click(failedTab);

        const retryButton = screen.getByLabelText("Retry failed attempt");
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(attemptsMocks.startAttemptRequest).toHaveBeenCalledTimes(1);
        });
        expect(attemptsMocks.startAttemptRequest).toHaveBeenCalledWith({
            projectId: "proj-2",
            cardId: "card-2",
            agent: "AGENT_FAILED",
        });
        expect(onReload).toHaveBeenCalled();
    });

    it("does not show success toast or reload when retry metadata is missing", async () => {
        const onReload = vi.fn();
        const inbox = createInbox();
        const brokenInbox: DashboardInbox = {
            ...inbox,
            failed: [
                {
                    ...inbox.failed[0],
                    projectId: undefined,
                },
            ],
        };

        renderInboxPanel({inbox: brokenInbox, onReload});

        const failedTab = screen.getByRole("tab", {name: /Failed/i});
        fireEvent.click(failedTab);

        const retryButton = screen.getByLabelText("Retry failed attempt");
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(attemptsMocks.startAttemptRequest).not.toHaveBeenCalled();
        });
        expect(onReload).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalled();
    });
});
