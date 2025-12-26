import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { KanbanCard } from "@/components/kanban/Card";
import type { Card } from "shared";

const baseCard: Card = {
    id: "card-1",
    title: "Test ticket",
    description: "Test description",
    isEnhanced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

describe("KanbanCard – failed status styling", () => {
    it("renders a Failed badge when attempt status is failed", () => {
        render(
            <KanbanCard
                card={baseCard}
                attemptStatus="failed"
            />,
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
        );

        const badge = screen.queryByText("Failed");
        expect(badge).toBeNull();
    });

    it("applies red styling when attempt status is failed", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="failed"
            />,
        );

        const cardElement = container.querySelector('[class*="bg-red-50/80"]');
        expect(cardElement).toBeTruthy();
    });

    it("applies red dark mode styling when attempt status is failed", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="failed"
            />,
        );

        const cardElement = container.querySelector('[class*="dark:bg-red-950/20"]');
        expect(cardElement).toBeTruthy();
    });

    it("applies destructive ring styling when attempt status is failed", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="failed"
            />,
        );

        const cardElement = container.querySelector('[class*="ring-destructive/40"]');
        expect(cardElement).toBeTruthy();
    });

    it("does not apply failed styling when attempt status is succeeded", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                attemptStatus="succeeded"
            />,
        );

        const cardElement = container.querySelector('[class*="bg-red-50/80"]');
        expect(cardElement).toBeNull();
    });

    it("prioritizes failed styling over blocked styling when both apply", () => {
        const { container } = render(
            <KanbanCard
                card={baseCard}
                blocked={true}
                attemptStatus="failed"
            />,
        );

        const hasFailedBg = container.querySelector('[class*="bg-red-50/80"]');
        const hasBlockedBg = container.querySelector('[class*="bg-rose-50/70"]');

        expect(hasFailedBg).toBeTruthy();
        expect(hasBlockedBg).toBeNull();
    });

    it("does not render Failed badge when attempt status is undefined", () => {
        render(
            <KanbanCard
                card={baseCard}
            />,
        );

        const badge = screen.queryByText("Failed");
        expect(badge).toBeNull();
    });
});
