import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CardEnhancementDialog } from "../src/components/kanban/card-dialogs/CardEnhancementDialog";

vi.mock("../src/hooks/github", () => ({
    useGithubAuthStatus: vi.fn(() => ({ data: { status: "invalid" } })),
}));

vi.mock("../src/hooks/projects", () => ({
    useProjectGithubOrigin: vi.fn(() => ({ data: null })),
    useProjectSettings: vi.fn(() => ({ data: { githubIssueAutoCreateEnabled: false } })),
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe("CardEnhancementDialog", () => {
    it("renders current and enhanced ticket content", () => {
        const Wrapper = createWrapper();
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current Title", description: "Current Desc" }}
                enhanced={{
                    title: "Enhanced Title",
                    description: "Enhanced Desc",
                }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        expect(screen.getByText("Current Title")).toBeTruthy();
        expect(screen.getByText("Current Desc")).toBeTruthy();
        expect(screen.getByText("Enhanced Title")).toBeTruthy();
        expect(screen.getByText("Enhanced Desc")).toBeTruthy();
    });

    it("calls Accept and Reject handlers", async () => {
        const Wrapper = createWrapper();
        const onAccept = vi.fn();
        const onReject = vi.fn();

        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={onAccept}
                onReject={onReject}
            />,
            { wrapper: Wrapper },
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
