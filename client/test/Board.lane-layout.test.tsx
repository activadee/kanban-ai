import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Board } from "@/components/kanban/Board";
import type { BoardState, ColumnKey } from "shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

vi.mock("@dnd-kit/core", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@dnd-kit/core")>();
    return {
        ...actual,
        DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        DragOverlay: () => null,
    };
});

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
    return {
        ...actual,
        useSortable: vi.fn(() => ({
            attributes: {},
            listeners: {},
            setNodeRef: vi.fn(),
            transform: null,
            transition: null,
            isDragging: false,
        })),
        SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

vi.mock("react-resizable-panels", () => ({
    Group: ({ children }: { children: React.ReactNode }) => <div data-testid="resizable-group">{children}</div>,
    Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="resizable-panel">{children}</div>,
    Separator: () => <div data-testid="resizable-separator" />,
    useDefaultLayout: vi.fn(() => ({
        defaultLayout: undefined,
        onLayoutChange: vi.fn(),
    })),
}));

const createMockBoardState = (columnCount = 4): BoardState => {
    const columns: BoardState["columns"] = {};
    const columnOrder: string[] = [];
    const cards: BoardState["cards"] = {};

    const columnConfigs: Array<{ key: ColumnKey; title: string }> = [
        { key: "backlog", title: "Backlog" },
        { key: "inProgress", title: "In Progress" },
        { key: "review", title: "Review" },
        { key: "done", title: "Done" },
    ];

    for (let i = 0; i < columnCount; i++) {
        const config = columnConfigs[i];
        if (!config) continue;
        const colId = `col-${i}`;
        columns[colId] = {
            id: colId,
            key: config.key,
            title: config.title,
            cardIds: [`card-${i}`],
        };
        columnOrder.push(colId);
        cards[`card-${i}`] = {
            id: `card-${i}`,
            title: `Card ${i}`,
            description: `Description ${i}`,
            isEnhanced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    return { columns, columnOrder, cards };
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
);

const mockHandlers = {
    onCreateCard: vi.fn(),
    onUpdateCard: vi.fn(),
    onDeleteCard: vi.fn(),
    onMoveCard: vi.fn(),
};

describe("Board – lane layout maintains width during panel resize", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("has overflow-x-auto on board container for horizontal scrolling", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const scrollableContainer = container.querySelector('[class*="overflow-x-auto"]');
        expect(scrollableContainer).toBeTruthy();
    });

    it("lane wrappers have flex-1 to expand and fill available space", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const laneWrappers = container.querySelectorAll('[class*="flex-1"]');
        expect(laneWrappers.length).toBeGreaterThanOrEqual(4);
    });

    it("lane wrappers have shrink-0 to prevent shrinking below min-width", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const laneWrappers = container.querySelectorAll('[class*="shrink-0"]');
        expect(laneWrappers.length).toBeGreaterThanOrEqual(4);
    });

    it("lane wrappers have min-width classes to maintain readable width", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const laneWithMinWidth = container.querySelector('[class*="min-w-[280px]"]');
        expect(laneWithMinWidth).toBeTruthy();
    });

    it("lanes have responsive min-width classes", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const lanesWithResponsiveMinWidth = container.querySelectorAll('[class*="sm:min-w-"][class*="lg:min-w-"]');
        expect(lanesWithResponsiveMinWidth.length).toBeGreaterThanOrEqual(4);
    });

    it("renders all columns with proper flex and shrink-0 layout", () => {
        const state = createMockBoardState(4);
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const columnElements = container.querySelectorAll('[class*="flex-1"][class*="shrink-0"]');
        expect(columnElements.length).toBeGreaterThanOrEqual(4);
    });

    it("board uses flex layout with gap for lanes", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const flexContainer = container.querySelector('[class*="flex"][class*="gap-4"]');
        expect(flexContainer).toBeTruthy();
    });
});
