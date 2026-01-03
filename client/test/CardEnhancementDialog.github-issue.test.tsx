import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CardEnhancementDialog } from "../src/components/kanban/card-dialogs/CardEnhancementDialog";

let mockGithubAuthStatus = { data: { status: "valid" } };
let mockGithubOrigin = { data: { owner: "test-owner", repo: "test-repo" } };
let mockProjectSettings = { data: { githubIssueAutoCreateEnabled: true } };

vi.mock("../src/hooks/github", () => ({
    useGithubAuthStatus: vi.fn(() => mockGithubAuthStatus),
}));

vi.mock("../src/hooks/projects", () => ({
    useProjectGithubOrigin: vi.fn(() => mockGithubOrigin),
    useProjectSettings: vi.fn(() => mockProjectSettings),
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

describe("CardEnhancementDialog - GitHub Issue Feature", () => {
    beforeEach(() => {
        mockGithubAuthStatus = { data: { status: "valid" } };
        mockGithubOrigin = { data: { owner: "test-owner", repo: "test-repo" } };
        mockProjectSettings = { data: { githubIssueAutoCreateEnabled: true } };
        vi.clearAllMocks();
    });

    it("renders GitHub issue checkbox when GitHub is connected and enabled", () => {
        const Wrapper = createWrapper();
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        expect(screen.getByLabelText("Create GitHub Issue")).toBeTruthy();
        expect(screen.getByText(/Creates an issue in test-owner\/test-repo/)).toBeTruthy();
    });

    it("disables checkbox when GitHub auth is invalid", () => {
        mockGithubAuthStatus = { data: { status: "invalid" } };
        const Wrapper = createWrapper();
        
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toHaveProperty("disabled", true);
        expect(screen.getByText(/Enable GitHub Issue Creation in project settings/)).toBeTruthy();
    });

    it("disables checkbox when GitHub issue auto-create is disabled in settings", () => {
        mockProjectSettings = { data: { githubIssueAutoCreateEnabled: false } };
        const Wrapper = createWrapper();
        
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toHaveProperty("disabled", true);
    });

    it("disables checkbox when project has no GitHub origin", () => {
        mockGithubOrigin = { data: undefined as any };
        const Wrapper = createWrapper();
        
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toHaveProperty("disabled", true);
    });

    it("calls onAccept with true when checkbox is checked", async () => {
        const Wrapper = createWrapper();
        const onAccept = vi.fn();

        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={onAccept}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        const checkbox = screen.getByRole("checkbox");
        fireEvent.click(checkbox);

        const acceptButton = screen.getByRole("button", { name: "Accept" });
        fireEvent.click(acceptButton);

        await waitFor(() => {
            expect(onAccept).toHaveBeenCalledWith(true);
        });
    });

    it("calls onAccept with undefined when checkbox is not checked", async () => {
        const Wrapper = createWrapper();
        const onAccept = vi.fn();

        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={onAccept}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        const acceptButton = screen.getByRole("button", { name: "Accept" });
        fireEvent.click(acceptButton);

        await waitFor(() => {
            expect(onAccept).toHaveBeenCalledWith(undefined);
        });
    });

    it("shows 'Creating GitHub issue…' when submitting with checkbox checked", async () => {
        const Wrapper = createWrapper();
        const onAccept = vi.fn((): Promise<void> => new Promise(resolve => setTimeout(resolve, 100)));

        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={onAccept}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        const checkbox = screen.getByRole("checkbox");
        fireEvent.click(checkbox);

        const acceptButton = screen.getByRole("button", { name: "Accept" });
        fireEvent.click(acceptButton);

        expect(screen.getByText("Creating GitHub issue…")).toBeTruthy();
    });

    it("prevents button clicks during submission", async () => {
        const Wrapper = createWrapper();
        const onAccept = vi.fn((): Promise<void> => new Promise(resolve => setTimeout(resolve, 100)));

        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={onAccept}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        const acceptButton = screen.getByRole("button", { name: "Accept" });
        fireEvent.click(acceptButton);

        expect(acceptButton).toHaveProperty("disabled", true);
    });

    it("displays helper text with repository context", () => {
        const Wrapper = createWrapper();
        
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        expect(screen.getByText(/Creates an issue in test-owner\/test-repo when accepting this enhancement/)).toBeTruthy();
    });

    it("displays warning text when GitHub not connected or enabled", () => {
        mockGithubAuthStatus = { data: { status: "invalid" } };
        const Wrapper = createWrapper();
        
        render(
            <CardEnhancementDialog
                open
                onOpenChange={() => {}}
                projectId="test-project"
                boardId="test-board"
                current={{ title: "Current", description: "" }}
                enhanced={{ title: "Enhanced", description: "" }}
                onAccept={() => {}}
                onReject={() => {}}
            />,
            { wrapper: Wrapper },
        );

        expect(screen.getByText(/Enable GitHub Issue Creation in project settings and ensure GitHub is connected/)).toBeTruthy();
    });
});
