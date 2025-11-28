# Git Module

## Purpose

- Provide repository-level operations (status, diff, commit, push, merge) for both project repos and
  per-attempt worktrees.
- Emit `git.*` events so UI/WebSockets can react without tight coupling.
- Expose metadata helpers (branch resolution, file content lookup) shared across services.

## Data & Event Flow

1. **Repo Resolution**
    - `getRepoPath(projectId)` fetches the canonical repository path from the projects repo table.
    - Worktree-specific helpers accept `repoPath` directly.
2. **Event Emission**
    - `commitAtPath` publishes `git.commit.created` (with short SHA) + `git.status.changed`.
    - `pushAtPath` publishes `git.push.completed` and a status refresh.
    - `mergeBranchIntoBaseForProject` publishes `git.merge.completed` (used after a merge workflow).
3. **Listeners (`core/git/listeners.ts`)**
    - Core handles `attempt.autocommit.requested` by invoking `performAutoCommit`, applying the last assistant message
      as commit content and logging the outcome. When project settings enable it, the handler also pushes the branch
      after committing.

## Key Entry Points

- `core/git/service.ts`: primary git operations, re-exported from:
  - `core/git/events.ts` (event bus binding and git event emitters)
  - `core/git/identity.ts` (author name/email resolution and config)
  - `core/git/repo-service.ts` (project-repo operations by `projectId`)
  - `core/git/worktree-service.ts` (worktree-path operations for attempts)
- `core/git/listeners.ts`: event handlers for attempt-driven git automation.
- `branch.ts`: helper for branch template rendering.

## Open Tasks

- Add listener for `attempt.completed` to optionally refresh status/diffs after merges.
- Cache repeated fetch operations (e.g., resolve base refs) within a request scope.
- Provide unit tests for event emission (status, commit, push) and auto-commit handler.
---
title: Server: Git module
---
