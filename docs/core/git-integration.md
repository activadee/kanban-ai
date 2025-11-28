# Git integration

Last updated: 2025-11-28

## Overview

KanbanAI’s Git module provides repository-level operations for both project repositories and per-Attempt worktrees. It
emits `git.*` events so the UI and WebSocket layer can react to changes without tight coupling.

## Status and diff

- The Git module exposes helpers and endpoints to inspect repository state:
  - `GET /attempts/:id/git/status` – returns the current branch, staged/unstaged files, and summary for the Attempt’s
    worktree.
  - `GET /attempts/:id/git/file` – fetches file content for display in diff or editor views.
- In the UI:
  - The Changes dialog uses these endpoints to show a structured diff of what the agent (or you) have changed inside the
    Attempt worktree.

## Commit and push from the UI

- Attempt-scoped Git endpoints allow you to commit and push directly from KanbanAI:
  - `POST /attempts/:id/git/commit` – create a commit in the Attempt’s worktree using the provided message.
  - `POST /attempts/:id/git/push` – push the Attempt branch to the preferred remote.
- The Commit dialog:
  - Shows a summary of changes.
  - Lets you type a commit message.
  - Calls the Attempt Git endpoints under the hood.
- Whenever commits or pushes occur, the Git module emits events such as:
  - `git.commit.created`
  - `git.status.changed`
  - `git.push.completed`
  - These feed into WebSocket broadcasts so the UI stays up to date.

## Branch and merge helpers

- For projects with long-lived base branches (e.g. `main`), KanbanAI provides merge helpers so Attempt branches can be
  rebased/merged before opening a PR:
  - `mergeBranchIntoBaseForProject` performs a merge into the configured base branch and publishes `git.merge.completed`.
- In the UI, this is surfaced as a merge/refresh flow in the Attempt panel and PR dialog, helping you:
  - Ensure your Attempt branch is up to date.
  - Resolve conflicts in the Attempt worktree before creating a PR.

## Open in editor

- The Editor module integrates tightly with Git:
  - `POST /attempts/:id/open-editor` opens your preferred editor at the Attempt’s worktree path.
  - Editor detection and environment preparation are handled by the server (see `editor/README.md`).
- During this flow:
  - The server emits `editor.open.requested`, `editor.open.succeeded`, or `editor.open.failed`.
  - The UI surfaces success/failure state so you know whether the editor launch worked.

## Auto-commit and automation

- Auto-commit is driven by Git listeners reacting to Attempts:
  - On `attempt.completed` with status `succeeded`, the listener checks project settings:
    - If `autoCommitOnFinish` is enabled, it publishes `attempt.autocommit.requested` with worktree metadata.
  - A second listener handles `attempt.autocommit.requested` by calling `performAutoCommit`, which:
    - Builds a commit from the latest Attempt output.
    - Optionally pushes the branch when `autoPushOnAutocommit` is enabled.
- This behavior is controlled per project via the Repository defaults settings panel and the underlying
  `core/projects/settings` service.

