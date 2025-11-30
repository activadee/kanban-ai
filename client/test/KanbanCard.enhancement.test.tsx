import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { KanbanCard } from "@/components/kanban/Card";
import type { Card } from "shared";

const baseCard: Card = {
    id: "card-1",
    title: "Test ticket",
    description: "Test description",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

describe("KanbanCard – enhancement status", () => {
    it("renders an Enhancing badge when status is enhancing", () => {
        render(
            <KanbanCard
                card={baseCard}
                enhancementStatus="enhancing"
            />,
        );

        const badge = screen.getByText("Enhancing");
        expect(badge).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: "View enhancement diff" }),
        ).toBeNull();
    });

    it("renders an enhancement-ready icon that triggers callback", () => {
        const onEnhancementClick = vi.fn();

        render(
            <KanbanCard
                card={baseCard}
                enhancementStatus="ready"
                onEnhancementClick={onEnhancementClick}
            />,
        );

        const button = screen.getByRole("button", {
            name: "View enhancement diff",
        });

        fireEvent.click(button);

        expect(onEnhancementClick).toHaveBeenCalledTimes(1);
    });
});
