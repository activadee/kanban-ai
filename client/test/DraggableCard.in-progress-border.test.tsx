import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
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
    ticketType: "feat",
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

describe("DraggableCard – in-progress animated border", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes isInProgressLane=true when lane is inProgress", () => {
        const { container } = render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="inProgress"
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeTruthy();
    });

    it("passes isInProgressLane=false when lane is backlog", () => {
        const { container } = render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="backlog"
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("passes isInProgressLane=false when lane is review", () => {
        const { container } = render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="review"
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("passes isInProgressLane=false when lane is done", () => {
        const { container } = render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="done"
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("shows in-progress class with correct ticket type", () => {
        const fixCard: Card = { ...baseCard, ticketType: "fix" };
        const { container } = render(
            <DraggableCard
                card={fixCard}
                columnId="col-1"
                projectId="proj-1"
                lane="inProgress"
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector('.kanban-card--in-progress[data-ticket-type="fix"]');
        expect(card).toBeTruthy();
    });

    it("no in-progress class when attempt is not running even in inProgress lane", () => {
        const { container } = render(
            <DraggableCard
                card={baseCard}
                columnId="col-1"
                projectId="proj-1"
                lane="inProgress"
                attemptStatus="succeeded"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });
});
