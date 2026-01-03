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
- `server/src/worktrees/`: worktrees management module providing REST endpoints and business logic:
   - `worktrees.routes.ts`: REST route definitions for listing, syncing, and deleting worktrees.
   - `worktrees.handlers.ts`: request handlers with validation and error handling.
   - `worktrees.service.ts`: business logic for worktree operations (list, sync, delete tracked/orphaned/stale).
   - `worktrees.schemas.ts`: Zod schemas for request/response validation.

## Worktrees Service

The worktrees service manages Git worktrees created by Attempts and provides endpoints for listing, syncing, and cleaning up worktrees:

### REST Endpoints

- `GET /projects/:projectId/worktrees` – List all tracked, orphaned, and stale worktrees with summary statistics.
- `POST /projects/:projectId/worktrees/sync` – Scan the filesystem and database to discover new orphaned/stale worktrees.
- `DELETE /projects/:projectId/worktrees/:id` – Delete a tracked worktree with options (force, diskOnly, deleteBranch, deleteRemoteBranch).
- `DELETE /projects/:projectId/worktrees/orphaned/:encodedPath` – Delete an orphaned worktree found on disk.
- `DELETE /projects/:projectId/worktrees/stale/:id` – Remove a stale database entry.

### Data Structures

- **TrackedWorktree**: Worktree tracked in the database with associated Attempt metadata (status, branch, disk size, timestamps).
- **OrphanedWorktree**: Worktree found on disk but not in the database (path, size, last modified, branch name if detectable).
- **StaleWorktree**: Database entry for a worktree that no longer exists on disk (id, path, branch, creation time).
- **WorktreesSummary**: Aggregate statistics (tracked count, active count, orphaned count, stale count, total disk usage).

### Service Logic

- **List**: Queries the database for tracked worktrees, scans the filesystem for orphaned entries, and identifies stale records.
- **Sync**: Performs a full scan to discover new orphaned and stale worktrees, updating the summary.
- **Delete**: Removes worktrees from disk and/or database with validation (e.g., preventing deletion of active Attempts unless forced).

## Open Tasks

- Add listener for `attempt.completed` to optionally refresh status/diffs after merges.
- Cache repeated fetch operations (e.g., resolve base refs) within a request scope.
- Provide unit tests for event emission (status, commit, push) and auto-commit handler.
---
title: Server: Git module
---
