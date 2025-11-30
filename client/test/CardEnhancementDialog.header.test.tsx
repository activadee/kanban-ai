import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { CardEnhancementDialog } from "@/components/kanban/card-dialogs/CardEnhancementDialog";

describe("CardEnhancementDialog – header", () => {
    it("shows an AI suggestion label and clarification copy", () => {
        render(
            <CardEnhancementDialog
                open
                onOpenChange={vi.fn()}
                current={{ title: "Old", description: "before" }}
                enhanced={{ title: "New", description: "after" }}
                onAccept={vi.fn()}
                onReject={vi.fn()}
            />,
        );

        expect(screen.getByText(/AI suggestion ready/i)).toBeTruthy();
        expect(
            screen.getByText(/Your ticket was created successfully/i),
        ).toBeTruthy();
    });
});
