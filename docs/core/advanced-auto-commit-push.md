---
title: Auto-commit & auto-push
---

# Auto-commit & auto-push

## Overview

Auto-commit and auto-push let KanbanAI automatically commit and optionally push Attempt changes when an Attempt finishes
successfully, based on per-project settings.

## Configuration

- Project-level flags (repository defaults):
  - **Auto-commit on finish** (`autoCommitOnFinish`):
    - When enabled, a successful Attempt triggers an automatic commit in the Attempt worktree.
  - **Auto-push after auto-commit** (`autoPushOnAutocommit`):
    - When enabled alongside auto-commit, the auto-commit handler also pushes the branch to the preferred remote.
- These settings are managed by the project settings service and can be edited in the project Settings UI.

## Event flow

Git listeners orchestrate the automation:

- `attempt.completed` listener:
  - Fires whenever an Attempt finishes.
  - If the Attempt status is anything other than `succeeded`, it returns.
  - It loads project settings based on the board ID.
  - If `autoCommitOnFinish` is disabled, it returns.
  - Otherwise, it publishes `attempt.autocommit.requested` with:
    - `attemptId`, `boardId`, `cardId`.
    - `worktreePath`.
    - `profileId` (if present).
    - `autoPushOnAutocommit`.
    - `preferredRemote`.

- `attempt.autocommit.requested` listener:
  - Invokes `performAutoCommit` with the payload.
  - `performAutoCommit`:
    - Creates a commit in the Attempt worktree using content derived from the Attempt (e.g. last assistant message).
    - Optionally pushes the branch to `preferredRemote` when `autoPushOnAutocommit` is enabled.
    - Emits relevant `git.*` events (commit, status, push) so the UI can refresh.
  - Auto-commit runs while the Attempt still has an active worktree; if the card is later moved to **Done** and
    workspace cleanup runs, the `attempts.worktree_path` column for that Attempt is set to `NULL` and subsequent
    attempt-scoped Git operations will return a `409` "No worktree for attempt" problem response.

## Auto-push conflict recovery

When auto-push is enabled and a push operation fails due to a conflict (non-fast-forward rejection), the system automatically attempts to recover:

### Retry workflow

1. **Initial push fails**: The system detects a push conflict based on the error message (e.g., "rejected - non-fast-forward").
2. **Pull with rebase**: Executes `git pull --rebase` to fetch and rebase local commits on top of the remote changes.
3. **Rebase succeeds**: If the rebase completes without conflicts, the system retries the push operation.
4. **Rebase has conflicts**: If conflicts are detected during rebase, the rebase is aborted gracefully and the push is skipped.

### Behavior and guarantees

- **Single retry**: The system attempts rebase and retry **once only** per auto-push operation.
- **Graceful degradation**: Auto-commit always succeeds if changes exist; auto-push is best-effort.
- **Conflict detection**: The system detects conflicts during rebase using pattern matching on error output.
- **Clean state**: If rebase conflicts occur, `git rebase --abort` ensures the worktree returns to a clean state.
- **Non-blocking**: Push failures (including retry failures) do not fail the overall Attempt.

### Event notifications

The retry process emits the following events for real-time UI updates:

- `git.rebase.started`: Published when pull-rebase begins
- `git.rebase.completed`: Published when rebase succeeds
- `git.rebase.aborted`: Published when rebase has conflicts or fails (with reason: "conflicts" or "error")
- `git.push.retried`: Published when retry push is attempted
- `git.push.failed`: Published when push fails (including after retry exhaustion)

All operations are logged to attempt logs for visibility.

## Usage considerations

- Auto-commit and auto-push are best suited for:
  - Branches dedicated to Attempts/automation.
  - Teams that want Attempts to leave behind a clean, ready-to-review branch after success.
- For more manual workflows:
  - Keep auto-commit disabled.
  - Use the Commit dialog and push/PR flows from the UI instead.

See also:

- `core/git-integration.md` for commit/push endpoints and git events.
- `core/ai-attempts.md` for Attempt lifecycle and worktree behavior.
