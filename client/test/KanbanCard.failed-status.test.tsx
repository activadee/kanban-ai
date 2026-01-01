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

describe("KanbanCard – failed status styling", () => {
    it("renders a Failed badge when attempt status is failed", () => {
        render(
            <KanbanCard
                card={baseCard}
                attemptStatus="failed"
            />,
            { wrapper }
        );

        const badge = screen.getByText("Failed");
        expect(badge).toBeTruthy();
    });

    it("does not render a Failed badge when attempt status is not failed", () => {
        render(
            <KanbanCard
                card={baseCard}
                attemptStatus="succeeded"
            />,
            { wrapper }
        );

        const badge = screen.queryByText("Failed");
        expect(badge).toBeNull();
    });

    it("applies failed card class when attempt status is failed", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="failed"
            />,
            { wrapper }
        );

        const cardElement = container.querySelector('.kanban-card--failed');
        expect(cardElement).toBeTruthy();
    });

    it("does not apply failed styling when attempt status is succeeded", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="succeeded"
            />,
            { wrapper }
        );

        const cardElement = container.querySelector('.kanban-card--failed');
        expect(cardElement).toBeNull();
    });

    it("prioritizes failed styling over blocked styling when both apply", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                blocked={true}
                attemptStatus="failed"
            />,
            { wrapper }
        );

        const hasFailedClass = container.querySelector('.kanban-card--failed');
        const hasBlockedClass = container.querySelector('.kanban-card--blocked');

        expect(hasFailedClass).toBeTruthy();
        expect(hasBlockedClass).toBeNull();
    });

    it("does not render Failed badge when attempt status is undefined", () => {
        render(
            <KanbanCard
                card={baseCard}
            />,
            { wrapper }
        );

        const badge = screen.queryByText("Failed");
        expect(badge).toBeNull();
    });

    it("has cursor-not-allowed when failed", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="failed"
            />,
            { wrapper }
        );

        const cardElement = container.querySelector('[class*="cursor-not-allowed"]');
        expect(cardElement).toBeTruthy();
    });
});
