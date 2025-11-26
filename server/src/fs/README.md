# Filesystem Module

## Purpose

- Manage Git worktree provisioning/removal and repository discovery.
- Emit filesystem-related events so downstream services (git, UI) can track worktree lifecycle without direct coupling.

## Data & Event Flow

1. **Worktree Management (`worktree-runner.ts`)**
    - `createWorktree` ensures the target directory exists, fetches refs, and adds a worktree. On success it emits
      `worktree.created` with project/attempt metadata.
    - `removeWorktree` removes the worktree and emits `worktree.removed` (best-effort).
2. **Filesystem APIs (`routes.ts`)**
    - `/fs/git-repos` scans for local Git repositories (no events needed).
3. **Event Listeners (`listeners.ts`)**
    - `project.deleted` → purge both id-based and name-based worktree folders.

## Key Entry Points

- `paths.ts`: canonical worktree root + helpers for id/name-based paths.
- `worktree-runner.ts`: exec wrapper around `git worktree add/remove` with event emission.
- `listeners.ts`: cleanup logic responding to board/project events.

## Open Tasks

- Unit-test project-deletion worktree cleanup path.
- Surface errors back to the UI when cleanup fails (currently logged only).
