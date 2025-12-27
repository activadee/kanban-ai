import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/attempts/repo", () => ({
    getAttemptForCardByKind: vi.fn(),
    updateAttempt: vi.fn(),
}));

vi.mock("../src/projects/repo", () => ({
    getRepositoryPath: vi.fn(),
}));

vi.mock("../src/ports/worktree", () => ({
    removeWorktree: vi.fn(),
}));

const branchLocal = vi.fn();
const deleteLocalBranch = vi.fn();
const checkout = vi.fn();

vi.mock("simple-git", () => ({
    default: (..._args: unknown[]) => ({
        branchLocal,
        deleteLocalBranch,
        checkout,
    }),
}));

import { cleanupCardWorkspace } from "../src/tasks/cleanup";
import { getAttemptForCardByKind, updateAttempt } from "../src/attempts/repo";
import { getRepositoryPath } from "../src/projects/repo";
import { removeWorktree } from "../src/ports/worktree";

describe("tasks/cleanup", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        branchLocal.mockResolvedValue({ all: [], current: "main" });
    });

    it("removes worktree and branch when a Done card has an attempt", async () => {
        (getAttemptForCardByKind as any)
            .mockResolvedValueOnce({
            id: "att-1",
            boardId: "board-1",
            cardId: "card-1",
            agent: "X",
            status: "succeeded",
            baseBranch: "main",
            branchName: "feature/done",
            worktreePath: "/tmp/wt",
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .mockResolvedValueOnce(null);
        (getRepositoryPath as any).mockResolvedValue("/repo/path");
        branchLocal.mockResolvedValue({
            all: ["main", "feature/done"],
            current: "main",
        });

        const result = await cleanupCardWorkspace("board-1", "card-1");

        expect(result).toEqual({ worktreeRemoved: true, branchRemoved: true });
        expect(removeWorktree).toHaveBeenCalledWith("/repo/path", "/tmp/wt", {
            projectId: "board-1",
            attemptId: "att-1",
        });
        expect(deleteLocalBranch).toHaveBeenCalledWith("feature/done", true);
        expect(updateAttempt).toHaveBeenCalledWith(
            "att-1",
            expect.objectContaining({ worktreePath: null }),
        );
    });

    it("skips branch deletion when attempt branch matches base branch", async () => {
        (getAttemptForCardByKind as any)
            .mockResolvedValueOnce({
            id: "att-2",
            boardId: "board-1",
            cardId: "card-1",
            agent: "X",
            status: "succeeded",
            baseBranch: "main",
            branchName: "main",
            worktreePath: "/tmp/wt2",
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .mockResolvedValueOnce(null);
        (getRepositoryPath as any).mockResolvedValue("/repo/path");

        const result = await cleanupCardWorkspace("board-1", "card-1");

        expect(result).toEqual({ worktreeRemoved: true, branchRemoved: false });
        expect(removeWorktree).toHaveBeenCalledWith("/repo/path", "/tmp/wt2", {
            projectId: "board-1",
            attemptId: "att-2",
        });
        expect(branchLocal).not.toHaveBeenCalled();
        expect(deleteLocalBranch).not.toHaveBeenCalled();
    });

    it("skips cleanup when attempt is still running", async () => {
        (getAttemptForCardByKind as any)
            .mockResolvedValueOnce({
            id: "att-3",
            boardId: "board-1",
            cardId: "card-1",
            agent: "X",
            status: "running",
            baseBranch: "main",
            branchName: "feature/run",
            worktreePath: "/tmp/wt3",
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .mockResolvedValueOnce(null);
        (getRepositoryPath as any).mockResolvedValue("/repo/path");

        const result = await cleanupCardWorkspace("board-1", "card-1");

        expect(result).toEqual({
            worktreeRemoved: false,
            branchRemoved: false,
            skipped: "in_progress",
        });
        expect(removeWorktree).not.toHaveBeenCalled();
        expect(deleteLocalBranch).not.toHaveBeenCalled();
        expect(updateAttempt).not.toHaveBeenCalled();
    });

    it("keeps worktreePath when removal fails", async () => {
        (getAttemptForCardByKind as any)
            .mockResolvedValueOnce({
            id: "att-4",
            boardId: "board-1",
            cardId: "card-1",
            agent: "X",
            status: "succeeded",
            baseBranch: "main",
            branchName: "feature/fail",
            worktreePath: "/tmp/wt4",
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .mockResolvedValueOnce(null);
        (getRepositoryPath as any).mockResolvedValue("/repo/path");
        (removeWorktree as any).mockRejectedValue(new Error("boom"));

        const result = await cleanupCardWorkspace("board-1", "card-1");

        expect(result.worktreeRemoved).toBe(false);
        expect(updateAttempt).not.toHaveBeenCalled();
    });

    it("does not remove worktree when worktreePath is null", async () => {
        (getAttemptForCardByKind as any)
            .mockResolvedValueOnce({
            id: "att-5",
            boardId: "board-1",
            cardId: "card-1",
            agent: "X",
            status: "succeeded",
            baseBranch: "main",
            branchName: "feature/no-wt",
            worktreePath: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .mockResolvedValueOnce(null);
        (getRepositoryPath as any).mockResolvedValue("/repo/path");
        branchLocal.mockResolvedValue({
            all: ["main", "feature/no-wt"],
            current: "main",
        });

        const result = await cleanupCardWorkspace("board-1", "card-1");

        expect(result).toEqual({ worktreeRemoved: false, branchRemoved: true });
        expect(removeWorktree).not.toHaveBeenCalled();
        expect(updateAttempt).not.toHaveBeenCalled();
    });

    it("removes both implementation and planning attempt worktrees", async () => {
        (getAttemptForCardByKind as any)
            .mockResolvedValueOnce({
                id: "att-impl",
                boardId: "board-1",
                cardId: "card-1",
                agent: "X",
                status: "succeeded",
                baseBranch: "main",
                branchName: "feature/impl",
                worktreePath: "/tmp/wt-impl",
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .mockResolvedValueOnce({
                id: "att-plan",
                boardId: "board-1",
                cardId: "card-1",
                agent: "X",
                status: "succeeded",
                baseBranch: "main",
                branchName: "plan/feature/impl",
                worktreePath: "/tmp/wt-plan",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        (getRepositoryPath as any).mockResolvedValue("/repo/path");
        branchLocal.mockResolvedValue({
            all: ["main", "feature/impl", "plan/feature/impl"],
            current: "main",
        });

        const result = await cleanupCardWorkspace("board-1", "card-1");

        expect(result).toEqual({ worktreeRemoved: true, branchRemoved: true });
        expect(removeWorktree).toHaveBeenCalledWith("/repo/path", "/tmp/wt-impl", {
            projectId: "board-1",
            attemptId: "att-impl",
        });
        expect(removeWorktree).toHaveBeenCalledWith("/repo/path", "/tmp/wt-plan", {
            projectId: "board-1",
            attemptId: "att-plan",
        });
        expect(deleteLocalBranch).toHaveBeenCalledWith("feature/impl", true);
        expect(deleteLocalBranch).toHaveBeenCalledWith("plan/feature/impl", true);
        expect(updateAttempt).toHaveBeenCalledWith(
            "att-impl",
            expect.objectContaining({ worktreePath: null }),
        );
        expect(updateAttempt).toHaveBeenCalledWith(
            "att-plan",
            expect.objectContaining({ worktreePath: null }),
        );
    });
});
