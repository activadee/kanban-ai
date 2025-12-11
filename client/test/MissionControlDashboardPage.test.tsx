import React from "react";
import {describe, it, expect, beforeEach, vi} from "vitest";
import {render, cleanup, screen, fireEvent, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {MemoryRouter} from "react-router-dom";
import {
    DEFAULT_DASHBOARD_TIME_RANGE_PRESET,
    type DashboardOverview,
    type DashboardTimeRangePreset,
} from "shared";
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
        data: {agents: []},
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

// Simplified Select implementation for predictable testing.
vi.mock("@/components/ui/select", () => {
    const SelectContext = React.createContext<{
        value?: string;
        onChange?: (value: string) => void;
    }>({});

    const Select = ({value, onValueChange, children}: any) => (
        <SelectContext.Provider value={{value, onChange: onValueChange}}>
            <div data-slot="select">{children}</div>
        </SelectContext.Provider>
    );

    const SelectTrigger = ({children, ...props}: any) => (
        <button type="button" data-slot="select-trigger" {...props}>
            {children}
        </button>
    );

    const SelectValue = ({placeholder}: any) => <span>{placeholder}</span>;

    const SelectContent = ({children}: any) => (
        <div data-slot="select-content">{children}</div>
    );

    const SelectItem = ({value, children}: any) => {
        const ctx = React.useContext(SelectContext);
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

function createOverview(preset: DashboardTimeRangePreset = DEFAULT_DASHBOARD_TIME_RANGE_PRESET): DashboardOverview {
    const now = new Date().toISOString();
    return {
        timeRange: {preset},
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
        agentStats: [],
        attemptsInRange: 0,
        successRateInRange: 0,
        projectsWithActivityInRange: 0,
    };
}

function renderDashboard() {
    const client = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
        },
    });

    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <DashboardPage/>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe("Mission Control dashboard layout", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        window.sessionStorage.clear();

        dashboardMocks.useDashboardOverview.mockImplementation(
            (options?: { timeRangePreset?: DashboardTimeRangePreset }) => ({
                data: createOverview(options?.timeRangePreset ?? DEFAULT_DASHBOARD_TIME_RANGE_PRESET),
                isLoading: false,
                isFetching: false,
            }),
        );
    });

    it("renders Mission Control header and main sections", () => {
        renderDashboard();

        expect(screen.getByText("Mission Control")).toBeTruthy();
        expect(screen.getByText("Live Agent Activity")).toBeTruthy();
        expect(screen.getByText("Recent Attempt History")).toBeTruthy();
        expect(screen.getByText("Inbox")).toBeTruthy();
        expect(screen.getByText("Project Health")).toBeTruthy();
        expect(screen.getByText("Agents & System")).toBeTruthy();
    });

    it("stacks dashboard sections in the expected mobile order", () => {
        renderDashboard();

        const kpiRow = screen.getByRole("group", {name: /Key performance indicators/i});
        const liveActivityHeading = screen.getByText("Live Agent Activity");
        const inboxHeading = screen.getByText("Inbox");
        const projectsHeading = screen.getByText("Project Health");
        const agentsHeading = screen.getByText("Agents & System");
        const historyHeading = screen.getByText("Recent Attempt History");

        const isBefore = (a: HTMLElement, b: HTMLElement) =>
            (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

        expect(isBefore(kpiRow, liveActivityHeading)).toBe(true);
        expect(isBefore(liveActivityHeading, inboxHeading)).toBe(true);
        expect(isBefore(inboxHeading, projectsHeading)).toBe(true);
        expect(isBefore(projectsHeading, agentsHeading)).toBe(true);
        expect(isBefore(agentsHeading, historyHeading)).toBe(true);
    });

    it("uses a responsive two-column grid for main sections at large widths", () => {
        const {container} = renderDashboard();

        const gridSection = container.querySelector("section.grid");
        expect(gridSection).toBeTruthy();
        expect(gridSection?.className).toContain("xl:grid-cols-2");
    });

    it("renders KPI cards with expected labels", () => {
        renderDashboard();

        const kpiRow = screen.getByRole("group", {name: /Key performance indicators/i});

        expect(within(kpiRow).getByText("Active attempts")).toBeTruthy();
        expect(within(kpiRow).getByText("Attempts in range")).toBeTruthy();
        expect(within(kpiRow).getByText("Success rate")).toBeTruthy();
        expect(within(kpiRow).getByText("Items to review")).toBeTruthy();
        expect(within(kpiRow).getByText("Active projects")).toBeTruthy();
    });

    it("updates time range preset and KPI helper text when selection changes", () => {
        renderDashboard();

        // Initial hook call uses the default preset.
        expect(dashboardMocks.useDashboardOverview).toHaveBeenCalled();
        const firstCallOptions = dashboardMocks.useDashboardOverview.mock.calls[0][0];
        expect(firstCallOptions?.timeRangePreset).toBe(DEFAULT_DASHBOARD_TIME_RANGE_PRESET);

        // Initial KPI helper text reflects the default time range.
        const kpiRow = screen.getByRole("group", {name: /Key performance indicators/i});
        expect(within(kpiRow).getByText(/Last 7 days/i)).toBeTruthy();

        // Change the time range to "Last 24 hours".
        const last24hOption = screen.getByRole("option", {name: /Last 24 hours/i});
        fireEvent.click(last24hOption);

        const lastCallOptions =
            dashboardMocks.useDashboardOverview.mock.calls[
                dashboardMocks.useDashboardOverview.mock.calls.length - 1
                ][0];
        expect(lastCallOptions?.timeRangePreset).toBe("last_24h");

        // KPI helper text reflects the newly selected range.
        const updatedKpiRow = screen.getByRole("group", {name: /Key performance indicators/i});
        expect(within(updatedKpiRow).getByText(/Last 24 hours/i)).toBeTruthy();

        // Selection is persisted for the current session.
        expect(window.sessionStorage.getItem("dashboard.timeRangePreset")).toBe("last_24h");
    });

    it("initializes the time range from session storage when available", () => {
        window.sessionStorage.setItem("dashboard.timeRangePreset", "last_24h");

        renderDashboard();

        expect(dashboardMocks.useDashboardOverview).toHaveBeenCalled();
        const firstCallOptions = dashboardMocks.useDashboardOverview.mock.calls[0][0];
        expect(firstCallOptions?.timeRangePreset).toBe("last_24h");
    });

    it("shows a contextual KPI empty state when there is no dashboard activity", () => {
        renderDashboard();

        expect(
            screen.getByTestId("kpi-empty-state"),
        ).toBeTruthy();
    });

    it("keeps other sections responsive when KPI loading reports an error", () => {
        dashboardMocks.useDashboardOverview.mockImplementationOnce(
            (options?: { timeRangePreset?: DashboardTimeRangePreset }) => ({
                data: createOverview(options?.timeRangePreset ?? DEFAULT_DASHBOARD_TIME_RANGE_PRESET),
                isLoading: false,
                isFetching: false,
                isError: true,
                refetch: vi.fn(),
            }),
        );

        renderDashboard();

        expect(
            screen.getByText(/Unable to load KPIs/i),
        ).toBeTruthy();

        // Other dashboard sections still render their headers.
        expect(screen.getByText("Live Agent Activity")).toBeTruthy();
        expect(screen.getByText("Inbox")).toBeTruthy();
        expect(screen.getByText("Project Health")).toBeTruthy();
        expect(screen.getByText("Agents & System")).toBeTruthy();
    });
});
