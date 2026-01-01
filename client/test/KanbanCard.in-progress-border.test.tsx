import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { KanbanCard } from "@/components/kanban/Card";
import type { Card } from "shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

describe("KanbanCard – in-progress animated border", () => {
    it("shows animated border class when in progress lane and attempt is running", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeTruthy();
    });

    it("does not show animated border when not in progress lane", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={false}
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("does not show animated border when attempt is not running", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
                attemptStatus="succeeded"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("does not show animated border when attempt status is undefined", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("does not show animated border when attempt is queued", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
                attemptStatus="queued"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("does not show animated border when attempt is stopped", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
                attemptStatus="stopped"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });

    it("applies in-progress class to card with feat ticket type", () => {
        const featCard: Card = { ...baseCard, ticketType: "feat" };
        const { container } = render(
            <KanbanCard
                card={featCard}
                isInProgressLane={true}
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector('.kanban-card--in-progress[data-ticket-type="feat"]');
        expect(card).toBeTruthy();
    });

    it("applies in-progress class to card with fix ticket type", () => {
        const fixCard: Card = { ...baseCard, ticketType: "fix" };
        const { container } = render(
            <KanbanCard
                card={fixCard}
                isInProgressLane={true}
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector('.kanban-card--in-progress[data-ticket-type="fix"]');
        expect(card).toBeTruthy();
    });

    it("applies in-progress class to card with chore ticket type", () => {
        const choreCard: Card = { ...baseCard, ticketType: "chore" };
        const { container } = render(
            <KanbanCard
                card={choreCard}
                isInProgressLane={true}
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector('.kanban-card--in-progress[data-ticket-type="chore"]');
        expect(card).toBeTruthy();
    });

    it("applies in-progress class to card with refactor ticket type", () => {
        const refactorCard: Card = { ...baseCard, ticketType: "refactor" };
        const { container } = render(
            <KanbanCard
                card={refactorCard}
                isInProgressLane={true}
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector('.kanban-card--in-progress[data-ticket-type="refactor"]');
        expect(card).toBeTruthy();
    });

    it("still renders card content when in progress", () => {
        render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
                attemptStatus="running"
            />,
            { wrapper }
        );

        expect(screen.getByText("Test ticket")).toBeTruthy();
    });

    it("in-progress state takes precedence over blocked state", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
                attemptStatus="running"
                blocked={true}
                blockers={["Dependency 1"]}
            />,
            { wrapper }
        );

        const inProgressCard = container.querySelector(".kanban-card--in-progress");
        const blockedCard = container.querySelector(".kanban-card--blocked");
        expect(inProgressCard).toBeTruthy();
        expect(blockedCard).toBeNull();
    });

    it("failed state takes precedence over in-progress state", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                isInProgressLane={true}
                attemptStatus="failed"
            />,
            { wrapper }
        );

        const inProgressCard = container.querySelector(".kanban-card--in-progress");
        const failedCard = container.querySelector(".kanban-card--failed");
        expect(inProgressCard).toBeNull();
        expect(failedCard).toBeTruthy();
        expect(screen.getByText("Failed")).toBeTruthy();
    });

    it("defaults isInProgressLane to false when not provided", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="running"
            />,
            { wrapper }
        );

        const card = container.querySelector(".kanban-card--in-progress");
        expect(card).toBeNull();
    });
});
