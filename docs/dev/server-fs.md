# Filesystem Module

## Purpose

- Manage Git worktree provisioning/removal and repository discovery.
- Provide file browsing capabilities for editor and file selection.
- Emit filesystem-related events so downstream services (git, UI) can track worktree lifecycle without direct coupling.

## Data & Event Flow

1. **Worktree Management (`worktree-runner.ts`)**
    - `createWorktree` ensures the target directory exists, fetches refs, and adds a worktree. On success it emits
      `worktree.created` with project/attempt metadata.
    - `removeWorktree` removes the worktree and emits `worktree.removed` (best-effort).
2. **File Browsing (`browse.ts`)**
    - `browseDirectory` provides directory listing with metadata (name, path, type, executable flag, size).
    - Supports filtering by hidden files and executables only.
    - Used by the UI for file browser dialogs (e.g., selecting editor executables).
3. **Filesystem APIs (`routes.ts`)**
    - `GET /fs/git-repos` scans for local Git repositories (no events needed).
    - `GET /fs/browse` browses directories with optional filtering (path, showHidden, executablesOnly).
4. **Event Listeners (`listeners.ts`)**
    - `project.deleted` → purge both id-based and name-based worktree folders and prune stale Git worktree entries for the project's repository.

## Key Entry Points

- `paths.ts`: canonical worktree root + helpers for id/name-based paths.
- `worktree-runner.ts`: exec wrapper around `git worktree add/remove` with event emission.
- `browse.ts`: directory browsing functionality with filtering options.
- `listeners.ts`: cleanup logic responding to board/project events.

## Types

- `FileBrowserEntry`: represents a file or directory entry with metadata.
- `BrowseDirectoryOptions`: options for browsing (path, showHidden, executablesOnly).
- `BrowseDirectoryResult`: result containing entries, currentPath, and parentPath.

## Open Tasks

- Unit-test project-deletion worktree cleanup path.
- Surface errors back to the UI when cleanup fails (currently logged only).
---
title: Server: Filesystem module
---
