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

    it("lane wrappers use flex-1 to fill available width", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const laneWrappers = container.querySelectorAll('[class*="flex-1"][class*="h-full"]');
        expect(laneWrappers.length).toBeGreaterThanOrEqual(4);
    });

    it("board flex container has inline min-width style to prevent shrinking", () => {
        const state = createMockBoardState(4);
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
        
        const style = flexContainer?.getAttribute("style");
        expect(style).toContain("min-width");
    });

    it("calculates correct min-width based on column count", () => {
        const state = createMockBoardState(4);
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const flexContainer = container.querySelector('[class*="flex"][class*="gap-4"]');
        const style = flexContainer?.getAttribute("style");
        
        const laneMinWidth = 280;
        const laneGap = 16;
        const expectedMinWidth = 4 * laneMinWidth + 3 * laneGap;
        
        expect(style).toContain(`min-width: ${expectedMinWidth}px`);
    });

    it("lanes do not have fixed width classes (uses flex-1 instead)", () => {
        const state = createMockBoardState();
        const { container } = render(
            <Board
                projectId="test-project"
                state={state}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const fixedWidthElements = container.querySelectorAll('[class*="w-[280px]"]');
        expect(fixedWidthElements.length).toBe(0);
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

    it("min-width scales with different column counts", () => {
        const state2 = createMockBoardState(2);
        const { container: container2 } = render(
            <Board
                projectId="test-project"
                state={state2}
                handlers={mockHandlers}
            />,
            { wrapper }
        );

        const flexContainer2 = container2.querySelector('[class*="flex"][class*="gap-4"]');
        const style2 = flexContainer2?.getAttribute("style");
        
        const expectedMinWidth2 = 2 * 280 + 1 * 16;
        expect(style2).toContain(`min-width: ${expectedMinWidth2}px`);
    });
});
