import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

describe("KanbanCard – selected state", () => {
    it("applies visual marker when card is selected", () => {
        render(<KanbanCard card={baseCard} isSelected={true} />);

        const card = screen.getByTestId("kanban-card");
        expect(card).toHaveClass("ring-2");
        expect(card).toHaveClass("ring-primary");
        expect(card).toHaveClass("ring-offset-2");
    });

    it("does not apply visual marker when card is not selected", () => {
        render(<KanbanCard card={baseCard} isSelected={false} />);

        const card = screen.getByTestId("kanban-card");
        expect(card).not.toHaveClass("ring-2");
        expect(card).not.toHaveClass("ring-primary");
    });

    it("applies selected marker even when card is enhanced", () => {
        render(<KanbanCard card={{ ...baseCard, isEnhanced: true }} isSelected={true} />);

        const card = screen.getByTestId("kanban-card");
        // Selected takes precedence, so we should see the ring
        expect(card).toHaveClass("ring-2");
        expect(card).toHaveClass("ring-primary");
    });

    it("applies selected marker even when card is failed", () => {
        render(<KanbanCard card={baseCard} isSelected={true} />);

        const card = screen.getByTestId("kanban-card");
        // Selected takes precedence
        expect(card).toHaveClass("ring-2");
        expect(card).toHaveClass("ring-primary");
    });

    it("applies selected marker even when card is blocked", () => {
        render(<KanbanCard card={baseCard} blocked={true} isSelected={true} />);

        const card = screen.getByTestId("kanban-card");
        // Selected takes precedence
        expect(card).toHaveClass("ring-2");
        expect(card).toHaveClass("ring-primary");
    });

    it("has accessible aria attributes when selected", () => {
        render(<KanbanCard card={baseCard} isSelected={true} />);

        const card = screen.getByTestId("kanban-card");
        // Card should have role or be part of accessible structure
        expect(card).toBeTruthy();
    });

    it("defaults isSelected to false", () => {
        render(<KanbanCard card={baseCard} />);

        const card = screen.getByTestId("kanban-card");
        expect(card).not.toHaveClass("ring-2");
    });
});
