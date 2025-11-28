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
