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

describe("Board – lane layout for panel resizing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not have overflow-x-auto on the board container", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const boardContainer = container.querySelector('[class*="overflow-hidden"]');
        expect(boardContainer).toBeTruthy();

        const scrollableContainer = container.querySelector('[class*="overflow-x-auto"]');
        expect(scrollableContainer).toBeNull();
    });

    it("has overflow-hidden on the board container to prevent unwanted scrolling", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const boardContainer = container.querySelector('[class*="overflow-hidden"]');
        expect(boardContainer).toBeTruthy();
    });

    it("lane wrappers have min-w-0 to allow flex shrinking", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const laneWrappers = container.querySelectorAll('[class*="min-w-0"]');
        expect(laneWrappers.length).toBeGreaterThanOrEqual(4);
    });

    it("lane wrappers do not have fixed min-width classes that force scrolling", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const fixedMinWidthPatterns = [
            "min-w-[260px]",
            "min-w-[280px]",
            "min-w-[300px]",
            "min-w-[320px]",
        ];

        for (const pattern of fixedMinWidthPatterns) {
            const elementsWithFixedMinWidth = container.querySelectorAll(`[class*="${pattern}"]`);
            expect(elementsWithFixedMinWidth.length).toBe(0);
        }
    });

    it("lane flex container uses w-full instead of min-w-full", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const flexContainerWithWFull = container.querySelector('[class*="flex"][class*="w-full"]');
        expect(flexContainerWithWFull).toBeTruthy();

        const flexContainerWithMinWFull = container.querySelector('[class*="flex"][class*="min-w-full"]');
        expect(flexContainerWithMinWFull).toBeNull();
    });

    it("lanes use flex-1 and basis-0 for equal distribution", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const laneWrappers = container.querySelectorAll('[class*="flex-1"][class*="basis-0"]');
        expect(laneWrappers.length).toBeGreaterThanOrEqual(4);
    });

    it("renders all columns with proper layout classes", () => {
        const state = createMockBoardState(4);
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const columnElements = container.querySelectorAll('[class*="h-full"][class*="min-h-0"][class*="flex-1"]');
        expect(columnElements.length).toBeGreaterThanOrEqual(4);
    });

    it("board layout adapts to container width without forcing scroll", () => {
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
