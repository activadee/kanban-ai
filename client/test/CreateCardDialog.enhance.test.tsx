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

const { useNextTicketKeyMock, enhanceMutationRef } = vi.hoisted(() => {
    return {
        useNextTicketKeyMock: vi.fn(),
        enhanceMutationRef: {
            current: {
                mutate: vi.fn(),
            } as { mutate: ReturnType<typeof vi.fn> },
        },
    };
});

vi.mock("@/hooks", () => ({
    useNextTicketKey: useNextTicketKeyMock,
}));

vi.mock("@/hooks/projects", () => ({
    useEnhanceTicket: () => enhanceMutationRef.current,
}));

vi.mock("@/components/ui/toast", () => ({
    toast: vi.fn(),
}));

vi.mock("@/api/http", () => ({
    describeApiError: vi.fn((_err: unknown, fallback: string) => ({
        title: fallback,
        description: String(_err ?? ""),
    })),
}));

let latestMutate: ReturnType<typeof vi.fn>;

function renderDialog() {
    const queryClient = new QueryClient();

    return render(
        <QueryClientProvider client={queryClient}>
            <CreateCardDialog
                open
                onOpenChange={() => {}}
                columns={[{ id: "col-1", title: "Backlog" }]}
                defaultColumnId="col-1"
                projectId="proj-1"
                onSubmit={vi.fn()}
                availableCards={[]}
            />
        </QueryClientProvider>,
    );
}

describe("CreateCardDialog – Enhance ticket", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();

        useNextTicketKeyMock.mockReturnValue({
            isLoading: false,
            data: { key: "PRJ-1" },
        });

        latestMutate = vi.fn();
        enhanceMutationRef.current = {
            mutate: latestMutate,
        };
    });

    it("disables enhance button without title and calls mutation with trimmed title", () => {
        renderDialog();

        const enhanceButton = screen.getByRole("button", {
            name: "Enhance ticket",
        }) as HTMLButtonElement;

        expect(enhanceButton.disabled).toBe(true);

        const titleInput = screen.getByLabelText("Title");

        fireEvent.change(titleInput, { target: { value: "  Original Title  " } });

        expect(enhanceButton.disabled).toBe(false);

        fireEvent.click(enhanceButton);

        expect(latestMutate).toHaveBeenCalledTimes(1);

        const [params] = latestMutate.mock.calls[0] as [any];

        expect(params).toMatchObject({
            projectId: "proj-1",
            title: "Original Title",
            description: "",
        });
    });

    it("shows suggestion preview and Accept applies enhanced values", async () => {
        const mutateSpy = vi.fn(
            (_params: any, options?: { onSuccess?: (data: any) => void }) => {
                options?.onSuccess?.({
                    ticket: {
                        title: "Enhanced Title",
                        description: "Enhanced Description",
                    },
                });
            },
        );

        enhanceMutationRef.current = {
            mutate: mutateSpy,
        };

        renderDialog();

        const titleInput = screen.getByLabelText("Title");
        const descriptionInput = screen.getByLabelText("Description");

        fireEvent.change(titleInput, {
            target: { value: "Original Title" },
        });
        fireEvent.change(descriptionInput, {
            target: { value: "Original Description" },
        });

        const enhanceButton = screen.getByRole("button", {
            name: "Enhance ticket",
        });

        fireEvent.click(enhanceButton);

        expect(mutateSpy).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(screen.queryByText("AI suggestion preview")).not.toBeNull();
        });

        const acceptButton = screen.getByRole("button", { name: "Accept" });

        fireEvent.click(acceptButton);

        await waitFor(() => {
            expect(screen.queryByText("AI suggestion preview")).toBeNull();
        });

        expect(
            (screen.getByLabelText("Title") as HTMLInputElement).value,
        ).toBe("Enhanced Title");
        expect(
            (screen.getByLabelText("Description") as HTMLTextAreaElement).value,
        ).toBe("Enhanced Description");
    });

    it("Reject hides suggestion preview and keeps original values", async () => {
        const mutateSpy = vi.fn(
            (_params: any, options?: { onSuccess?: (data: any) => void }) => {
                options?.onSuccess?.({
                    ticket: {
                        title: "Enhanced Title",
                        description: "Enhanced Description",
                    },
                });
            },
        );

        enhanceMutationRef.current = {
            mutate: mutateSpy,
        };

        renderDialog();

        const titleInput = screen.getByLabelText("Title");
        const descriptionInput = screen.getByLabelText("Description");

        fireEvent.change(titleInput, {
            target: { value: "Original Title" },
        });
        fireEvent.change(descriptionInput, {
            target: { value: "Original Description" },
        });

        const enhanceButton = screen.getByRole("button", {
            name: "Enhance ticket",
        });

        fireEvent.click(enhanceButton);

        expect(mutateSpy).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(screen.queryByText("AI suggestion preview")).not.toBeNull();
        });

        const rejectButton = screen.getByRole("button", { name: "Reject" });

        fireEvent.click(rejectButton);

        await waitFor(() => {
            expect(screen.queryByText("AI suggestion preview")).toBeNull();
        });

        expect(
            (screen.getByLabelText("Title") as HTMLInputElement).value,
        ).toBe("Original Title");
        expect(
            (screen.getByLabelText("Description") as HTMLTextAreaElement).value,
        ).toBe("Original Description");
    });
});
