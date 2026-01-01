import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    render,
    cleanup,
    fireEvent,
    screen,
    waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CreateCardDialog } from "@/components/kanban/card-dialogs/CreateCardDialog";

const { useNextTicketKeyMock } = vi.hoisted(() => {
    return {
        useNextTicketKeyMock: vi.fn(),
    };
});

const { useProjectSettingsMock } = vi.hoisted(() => {
    return {
        useProjectSettingsMock: vi.fn(),
    };
});

const { useGithubAuthStatusMock } = vi.hoisted(() => {
    return {
        useGithubAuthStatusMock: vi.fn(),
    };
});

const { useProjectGithubOriginMock } = vi.hoisted(() => {
    return {
        useProjectGithubOriginMock: vi.fn(),
    };
});

vi.mock("@/hooks", () => ({
    useNextTicketKey: useNextTicketKeyMock,
    useProjectSettings: useProjectSettingsMock,
    useImagePaste: () => ({
        pendingImages: [],
        addImagesFromClipboard: vi.fn().mockResolvedValue([]),
        addImagesFromDataTransfer: vi.fn().mockResolvedValue([]),
        removeImage: vi.fn(),
        clearImages: vi.fn(),
        canAddMore: true,
    }),
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
    const onCreateAndEnhance = vi.fn();
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
                onCreateAndEnhance={onCreateAndEnhance}
                availableCards={[]}
            />
        </QueryClientProvider>,
    );

    return { onSubmit, onCreateAndEnhance, onOpenChange };
}

describe("CreateCardDialog – Create & Enhance", () => {
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

    it("disables Create & Enhance without a title", () => {
        renderDialog();

        const createEnhanceButton = screen.getByRole("button", {
            name: "Create & Enhance",
        }) as HTMLButtonElement;

        expect(createEnhanceButton.disabled).toBe(true);

        const titleInput = screen.getByLabelText("Title");
        fireEvent.change(titleInput, {
            target: { value: "Some title" },
        });

        expect(createEnhanceButton.disabled).toBe(false);
    });

    it("calls onCreateAndEnhance with trimmed values", async () => {
        const { onSubmit, onCreateAndEnhance, onOpenChange } = renderDialog();

        const titleInput = screen.getByLabelText("Title");
        const descriptionInput = screen.getByLabelText("Description");

        fireEvent.change(titleInput, {
            target: { value: "  Original Title  " },
        });
        fireEvent.change(descriptionInput, {
            target: { value: "Original Description" },
        });

        const createEnhanceButton = screen.getByRole("button", {
            name: "Create & Enhance",
        });

        fireEvent.click(createEnhanceButton);

        await waitFor(() => {
            expect(onCreateAndEnhance).toHaveBeenCalledTimes(1);
        });

        expect(onSubmit).not.toHaveBeenCalled();

        expect(onCreateAndEnhance).toHaveBeenCalledWith(
            "col-1",
            expect.objectContaining({
                title: "Original Title",
                description: "Original Description",
                dependsOn: [],
                ticketType: "feat",
            }),
        );

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("closes once and does not re-open when enhancing", async () => {
        const { onOpenChange } = renderDialog();

        const titleInput = screen.getByLabelText("Title");
        fireEvent.change(titleInput, { target: { value: "Enhance me" } });

        const createEnhanceButton = screen.getByRole("button", {
            name: "Create & Enhance",
        });

        fireEvent.click(createEnhanceButton);

        await waitFor(() => {
            expect(onOpenChange).toHaveBeenCalledTimes(1);
        });

        expect(onOpenChange.mock.calls[0]).toEqual([false]);
    });

    it("Create Ticket calls onSubmit and not onCreateAndEnhance", async () => {
        const { onSubmit, onCreateAndEnhance } = renderDialog();

        const titleInput = screen.getByLabelText("Title");
        const descriptionInput = screen.getByLabelText("Description");

        fireEvent.change(titleInput, {
            target: { value: "Only Title" },
        });
        fireEvent.change(descriptionInput, {
            target: { value: "Some description" },
        });

        const createButton = screen.getByRole("button", {
            name: "Create Ticket",
        });

        fireEvent.click(createButton);

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        expect(onCreateAndEnhance).not.toHaveBeenCalled();
    });
});
