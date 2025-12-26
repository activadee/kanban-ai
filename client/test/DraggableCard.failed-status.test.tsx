import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraggableCard } from "@/components/kanban/DraggableCard";
import type { Card } from "shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const useSortableMock = vi.hoisted(() => vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
})));

vi.mock("@dnd-kit/sortable", () => ({
    useSortable: useSortableMock,
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
    it("disables drag listeners when status is failed", () => {
        useSortableMock.mockReturnValue({
            attributes: {},
            listeners: { onMouseDown: vi.fn() },
            setNodeRef: vi.fn(),
            transform: null,
            transition: null,
            isDragging: false,
        });

        const { container } = render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="inProgress"
                attemptStatus="failed"
            />,
            { wrapper }
        );

        const cardWrapper = container.firstChild as HTMLElement;
        expect(cardWrapper.className).toContain("cursor-not-allowed");
        expect(cardWrapper.className).toContain("opacity-70");
    });

    it("prevents click propagation/callback when failed", () => {
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

        expect(onSelect).not.toHaveBeenCalled();
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
