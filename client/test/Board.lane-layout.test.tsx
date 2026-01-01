import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
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
    let originalOffsetWidth: PropertyDescriptor | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    });

    afterEach(() => {
        if (originalOffsetWidth) {
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
        }
    });

    describe("structural layout", () => {
        it("has overflow-x-auto on scroll container for horizontal scrolling", () => {
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

        it("lane wrappers use flex-1 to distribute space evenly", () => {
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

        it("board uses flex layout with gap-4 for lanes", () => {
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

    describe("width capture and preservation", () => {
        it("captures container width on mount and applies it as minWidth", async () => {
            const mockWidth = 1200;
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
                configurable: true,
                get() {
                    return mockWidth;
                },
            });

            const state = createMockBoardState();
            let container: HTMLElement;
            
            await act(async () => {
                const result = render(
                    <Board
                        projectId="test-project"
                        state={state}
                        handlers={mockHandlers}
                    />,
                    { wrapper }
                );
                container = result.container;
            });

            const flexContainer = container!.querySelector('[class*="flex"][class*="gap-4"]');
            expect(flexContainer).toBeTruthy();
            
            const style = flexContainer?.getAttribute("style");
            expect(style).toContain(`min-width: ${mockWidth}px`);
        });

        it("preserves captured width even when container would shrink (simulating panel open)", async () => {
            const initialWidth = 1200;
            let currentWidth = initialWidth;
            
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
                configurable: true,
                get() {
                    return currentWidth;
                },
            });

            const state = createMockBoardState();
            let container: HTMLElement;
            
            await act(async () => {
                const result = render(
                    <Board
                        projectId="test-project"
                        state={state}
                        handlers={mockHandlers}
                    />,
                    { wrapper }
                );
                container = result.container;
            });

            const flexContainer = container!.querySelector('[class*="flex"][class*="gap-4"]');
            const initialStyle = flexContainer?.getAttribute("style");
            expect(initialStyle).toContain(`min-width: ${initialWidth}px`);

            currentWidth = 800;
            
            await act(async () => {
                window.dispatchEvent(new Event("resize"));
            });

            const styleAfterResize = flexContainer?.getAttribute("style");
            expect(styleAfterResize).toContain(`min-width: ${initialWidth}px`);
            expect(styleAfterResize).not.toContain(`min-width: ${currentWidth}px`);
        });

        it("does not apply minWidth style when container width is 0 (JSDOM default)", () => {
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
                configurable: true,
                get() {
                    return 0;
                },
            });

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
            const style = flexContainer?.getAttribute("style");
            expect(style).toBeNull();
        });

        it("captures width only once (does not re-capture on re-renders)", async () => {
            const initialWidth = 1200;
            let currentWidth = initialWidth;
            
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
                configurable: true,
                get() {
                    return currentWidth;
                },
            });

            const state = createMockBoardState();
            let container: HTMLElement;
            let rerender: (ui: React.ReactElement) => void;
            
            await act(async () => {
                const result = render(
                    <Board
                        projectId="test-project"
                        state={state}
                        handlers={mockHandlers}
                    />,
                    { wrapper }
                );
                container = result.container;
                rerender = result.rerender;
            });

            const flexContainer = container!.querySelector('[class*="flex"][class*="gap-4"]');
            const initialStyle = flexContainer?.getAttribute("style");
            expect(initialStyle).toContain(`min-width: ${initialWidth}px`);
            
            currentWidth = 800;
            
            await act(async () => {
                rerender(
                    <Board
                        projectId="test-project"
                        state={state}
                        handlers={mockHandlers}
                    />
                );
            });

            const styleAfterRerender = flexContainer?.getAttribute("style");
            expect(styleAfterRerender).toContain(`min-width: ${initialWidth}px`);
            expect(styleAfterRerender).not.toContain(`min-width: 800px`);
        });
    });
});
