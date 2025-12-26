import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraggableCard } from "@/components/kanban/DraggableCard";
import type { Card } from "shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@dnd-kit/sortable", () => ({
    useSortable: vi.fn(() => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: null,
        isDragging: false,
    })),
    verticalListSortingStrategy: {},
}));

const baseCard: Card = {
    id: "card-1",
    title: "Test ticket",
    description: "Test description",
    isEnhanced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("DraggableCard – failed status", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows clicking on failed tickets to open and retry", () => {
        const onSelect = vi.fn();
        render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="inProgress"
                attemptStatus="failed"
                onSelect={onSelect}
            />,
            { wrapper }
        );

        const cardElement = screen.getByText("Test ticket");
        fireEvent.click(cardElement);

        // Failed cards should allow clicking to open and retry
        expect(onSelect).toHaveBeenCalledWith(baseCard.id);
    });

    it("allows opening failed tickets for inspection and retry", () => {
        const onSelect = vi.fn();
        const onEdit = vi.fn();
        render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="inProgress"
                attemptStatus="failed"
                onSelect={onSelect}
                onEdit={onEdit}
            />,
            { wrapper }
        );

        const cardElement = screen.getByText("Test ticket");
        fireEvent.click(cardElement);

        // Click should trigger onSelect to open the inspector
        expect(onSelect).toHaveBeenCalledWith(baseCard.id);
    });

    it("allows click when not failed", () => {
        const onSelect = vi.fn();
        render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="inProgress"
                attemptStatus="succeeded"
                onSelect={onSelect}
            />,
            { wrapper }
        );

        const cardElement = screen.getByText("Test ticket");
        fireEvent.click(cardElement);

        expect(onSelect).toHaveBeenCalledWith(baseCard.id);
    });
});
