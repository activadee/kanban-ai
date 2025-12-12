import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CreateCardDialog } from "@/components/kanban/card-dialogs/CreateCardDialog";

const { useNextTicketKeyMock } = vi.hoisted(() => ({ useNextTicketKeyMock: vi.fn() }));
const { useProjectSettingsMock } = vi.hoisted(() => ({ useProjectSettingsMock: vi.fn() }));
const { useGithubAuthStatusMock } = vi.hoisted(() => ({ useGithubAuthStatusMock: vi.fn() }));
const { useProjectGithubOriginMock } = vi.hoisted(() => ({ useProjectGithubOriginMock: vi.fn() }));

vi.mock("@/hooks", () => ({
    useNextTicketKey: useNextTicketKeyMock,
    useProjectSettings: useProjectSettingsMock,
}));

vi.mock("@/hooks/github", () => ({
    useGithubAuthStatus: useGithubAuthStatusMock,
}));

vi.mock("@/hooks/projects", () => ({
    useProjectGithubOrigin: useProjectGithubOriginMock,
}));

function renderDialog() {
    const queryClient = new QueryClient();
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();

    render(
        <QueryClientProvider client={queryClient}>
            <CreateCardDialog
                open
                onOpenChange={onOpenChange}
                columns={[{ id: "col-1", title: "Backlog" }]}
                defaultColumnId="col-1"
                projectId="proj-1"
                onSubmit={onSubmit}
                availableCards={[]}
            />
        </QueryClientProvider>,
    );

    return { onSubmit, onOpenChange };
}

describe("CreateCardDialog – GitHub issue toggle", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();

        useNextTicketKeyMock.mockReturnValue({
            isLoading: false,
            data: { key: "PRJ-1" },
        });
        useProjectSettingsMock.mockReturnValue({
            isLoading: false,
            data: { githubIssueAutoCreateEnabled: true },
        });
        useGithubAuthStatusMock.mockReturnValue({
            isLoading: false,
            data: { status: "valid" },
        });
        useProjectGithubOriginMock.mockReturnValue({
            isLoading: false,
            data: { owner: "acme", repo: "repo" },
        });
    });

    it("passes createGithubIssue when checked", async () => {
        const { onSubmit } = renderDialog();

        fireEvent.change(screen.getByLabelText("Title"), {
            target: { value: "Hello" },
        });

        const checkbox = screen.getByLabelText("Create GitHub Issue") as HTMLInputElement;
        expect(checkbox.disabled).toBe(false);
        fireEvent.click(checkbox);

        fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith(
            "col-1",
            expect.objectContaining({
                title: "Hello",
                createGithubIssue: true,
            }),
        );
    });

    it("disables checkbox when auto-create is off", () => {
        useProjectSettingsMock.mockReturnValueOnce({
            isLoading: false,
            data: { githubIssueAutoCreateEnabled: false },
        });
        renderDialog();

        const checkbox = screen.getByLabelText("Create GitHub Issue") as HTMLInputElement;
        expect(checkbox.disabled).toBe(true);
    });
});

