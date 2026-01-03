import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("CardEnhancementDialog – header", () => {
    it("shows an AI suggestion label and explanatory text", () => {
        const Wrapper = createWrapper();
        render(
            <CardEnhancementDialog
                open
                onOpenChange={vi.fn()}
                projectId="test-project"
                current={{ title: "Old", description: "before" }}
                enhanced={{ title: "New", description: "after" }}
                onAccept={vi.fn()}
                onReject={vi.fn()}
            />,
            { wrapper: Wrapper },
        );

        expect(screen.getByText(/AI suggestion ready/i)).toBeTruthy();
        expect(screen.getByText(/AI-enhanced suggestion/i)).toBeTruthy();
    });
});
