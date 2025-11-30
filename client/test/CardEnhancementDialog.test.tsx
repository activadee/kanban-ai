import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

        expect(screen.getByText("Current Title")).toBeTruthy();
        expect(screen.getByText("Current Desc")).toBeTruthy();
        expect(screen.getByText("Enhanced Title")).toBeTruthy();
        expect(screen.getByText("Enhanced Desc")).toBeTruthy();
    });

    it("calls Accept and Reject handlers", async () => {
        const onAccept = vi.fn();
        const onReject = vi.fn();

        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={onAccept}
                onReject={onReject}
            />,
        );

        const acceptButton = screen.getByRole("button", { name: "Accept" });
        const rejectButton = screen.getByRole("button", { name: "Reject" });

        fireEvent.click(acceptButton);
        await waitFor(() => {
            expect(onAccept).toHaveBeenCalledTimes(1);
        });

        fireEvent.click(rejectButton);
        await waitFor(() => {
            expect(onReject).toHaveBeenCalledTimes(1);
        });
    });
});
