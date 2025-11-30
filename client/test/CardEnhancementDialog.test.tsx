import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CardEnhancementDialog } from "@/components/kanban/card-dialogs/CardEnhancementDialog";

describe("CardEnhancementDialog", () => {
    it("renders current and enhanced ticket content", () => {
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                current={{ title: "Current Title", description: "Current Desc" }}
                enhanced={{
                    title: "Enhanced Title",
                    description: "Enhanced Desc",
                }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
        );

        expect(screen.getByText("Current Title")).toBeInTheDocument();
        expect(screen.getByText("Current Desc")).toBeInTheDocument();
        expect(screen.getByText("Enhanced Title")).toBeInTheDocument();
        expect(screen.getByText("Enhanced Desc")).toBeInTheDocument();
    });

    it("calls Accept and Reject handlers", () => {
        const onAccept = vi.fn();
        const onReject = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <CardEnhancementDialog
                open
                onOpenChange={onOpenChange}
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={onAccept}
                onReject={onReject}
            />,
        );

        const acceptButton = screen.getByRole("button", { name: "Accept" });
        const rejectButton = screen.getByRole("button", { name: "Reject" });
        const closeButton = screen.getByRole("button", { name: "Close" });

        fireEvent.click(acceptButton);
        expect(onAccept).toHaveBeenCalledTimes(1);

        fireEvent.click(rejectButton);
        expect(onReject).toHaveBeenCalledTimes(1);

        fireEvent.click(closeButton);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

