# Projects Module

## Purpose

- Handle project CRUD operations, settings management, and ticket prefix logic.
- Expose project-scoped APIs (agent profiles, GitHub import) while emitting lifecycle events for other domains.

## Data & Event Flow

1. **Project CRUD (`routes.ts` + `service.ts`)**
    - `createProject` sets up the board and emits `project.created` (consumed by tasks, filesystem, etc.).
    - `updateProject` emits `project.updated` with the delta.
    - `deleteProject` removes the board and emits `project.deleted` (filesystem listener purges worktrees).
2. **Project Settings (`core/projects/settings`)**
    - `ensureProjectSettings`, `updateProjectSettings` live in the `core` package and manage branch/template defaults.
    - Settings updates emit `project.settings.updated` so other services can refresh caches.
3. **Agent Profiles (`core/agents/profiles`)**
    - CRUD endpoints emit `agent.profile.changed` to keep UI caches synced.
4. **GitHub Imports**
    - `/projects/:id/import/github/issues` calls `github/import.ts`, which emits `github.issues.imported` after
      completion.

## Key Entry Points

- `core/projects/service.ts`: abstraction around project records (imported by the server adapter).
- `routes.ts`: Hono endpoints with event emission.
- `core/projects/settings/service.ts`: per-project settings primitives.

## Open Tasks

- Move event emission out of routes and into service layer for reusability/testing.
- Add listeners reacting to `project.settings.updated` (e.g., branch template refresh).
- Provide tests for project lifecycle events and settings updates.
