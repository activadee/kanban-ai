import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ProjectSettingsDialog } from "@/components/projects/ProjectSettingsDialog";

const mocks = vi.hoisted(() => {
    return {
        useProject: vi.fn(() => ({
            data: { id: "proj-1", name: "Test Project" },
        })),
        useProjectSettings: vi.fn(() => ({
            data: null,
            isLoading: false,
            isError: false,
            error: null,
        })),
        useProjectBranches: vi.fn(() => ({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
        })),
        useAgents: vi.fn(() => ({
            data: { agents: [] },
            isLoading: false,
            isError: false,
            error: null,
        })),
        useAgentProfiles: vi.fn(() => ({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
        })),
        useUpdateProjectSettings: vi.fn(() => ({
            mutateAsync: vi.fn(),
            isPending: false,
        })),
    };
});

vi.mock("@/hooks", () => ({
    useProject: mocks.useProject,
    useProjectSettings: mocks.useProjectSettings,
    useProjectBranches: mocks.useProjectBranches,
    useAgents: mocks.useAgents,
    useAgentProfiles: mocks.useAgentProfiles,
    useUpdateProjectSettings: mocks.useUpdateProjectSettings,
}));

function renderProjectSettingsDialog() {
    const queryClient = new QueryClient();

    return render(
        <QueryClientProvider client={queryClient}>
            <ProjectSettingsDialog
                projectId="proj-1"
                open
                onOpenChange={() => {}}
            />
        </QueryClientProvider>,
    );
}

describe("ProjectSettingsDialog – scrollable Project Settings content", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("confines vertical scrolling to the Project Settings content area", () => {
        renderProjectSettingsDialog();

        // Dialog title should be present (dialog header).
        expect(
            screen.getAllByText("Project Settings").length,
        ).toBeGreaterThan(0);

        const dialogContent = document.querySelector(
            '[data-slot="dialog-content"]',
        ) as HTMLElement | null;

        expect(dialogContent).not.toBeNull();

        const className = dialogContent!.className;

        // DialogContent itself should not be scrollable; overflow is delegated to the inner ScrollArea.
        expect(className.includes("overflow-y-auto")).toBe(false);
        expect(className.includes("overflow-hidden")).toBe(true);

        // The Project Settings panel should render a scrollable content region.
        const scrollAreas = dialogContent!.querySelectorAll(
            "div.relative.overflow-y-auto",
        );
        expect(scrollAreas.length).toBeGreaterThanOrEqual(1);

        const scrollArea = scrollAreas[0] as HTMLElement;

        // Primary actions (Save changes, Reset) live in the sticky header,
        // not inside the scrollable content area.
        const saveButton = screen.getByRole("button", {
            name: /Save changes/i,
        });
        const resetButton = screen.getByRole("button", { name: /Reset/i });

        expect(scrollArea.contains(saveButton)).toBe(false);
        expect(scrollArea.contains(resetButton)).toBe(false);
    });
});
