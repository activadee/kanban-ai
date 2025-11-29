import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import type { Attempt } from "shared";

import { AttemptToolbar } from "@/components/kanban/card-inspector/AttemptToolbar";

const baseAttempt: Attempt = {
    id: "att-1",
    cardId: "card-1",
    boardId: "board-1",
    agent: "AGENT",
    status: "succeeded",
    baseBranch: "main",
    branchName: "feature/test",
    worktreePath: "/tmp",
    sessionId: null,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

describe("AttemptToolbar – Todos panel", () => {
    beforeEach(() => {
        cleanup();
    });

    it("does not render todo button when there are no todos", () => {
        render(
            <AttemptToolbar
                attempt={baseAttempt}
                openButtonDisabledReason={null}
                onOpenEditor={() => {}}
                onOpenChanges={() => {}}
                onOpenCommit={() => {}}
                onOpenPr={() => {}}
                onOpenMerge={() => {}}
                todoSummary={{ total: 0, completed: 0, items: [] }}
            />,
        );

        expect(
            screen.queryByRole("button", { name: /Todos/i }),
        ).toBeNull();
    });

    it("renders todo button and panel when todos exist", () => {
        render(
            <AttemptToolbar
                attempt={baseAttempt}
                openButtonDisabledReason={null}
                onOpenEditor={() => {}}
                onOpenChanges={() => {}}
                onOpenCommit={() => {}}
                onOpenPr={() => {}}
                onOpenMerge={() => {}}
                todoSummary={{
                    total: 4,
                    completed: 2,
                    items: [
                        { id: "1", text: "First", status: "open" },
                        { id: "2", text: "Second", status: "done" },
                    ],
                }}
            />,
        );

        const button = screen.getByRole("button", { name: /Todos/i });
        expect(button.textContent).toContain("2/4");

        fireEvent.click(button);

        expect(screen.getByText("Todos")).not.toBeNull();
        expect(screen.getByText("First")).not.toBeNull();
        expect(screen.getByText("Second")).not.toBeNull();
    });
});
