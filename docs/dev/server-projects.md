# Projects Module

## Purpose

- Handle project CRUD operations, settings management, and ticket prefix logic.
- Expose project-scoped APIs (agent profiles, GitHub import) while emitting lifecycle events for other domains.

## Data & Event Flow

1. **Project CRUD (`project.routes.ts` + `project.core.handlers.ts` + `core/projects/service.ts`)**
    - `createProject` sets up the board and emits `project.created` (consumed by tasks, filesystem, etc.).
    - `updateProject` emits `project.updated` with the delta.
    - `deleteProject` removes the board and emits `project.deleted` (filesystem listener purges worktrees).
2. **Project Settings (`project.settings.handlers.ts` + `core/projects/settings`)**
    - `ensureProjectSettings`, `updateProjectSettings` live in the `core` package and manage branch/template defaults.
    - Settings updates emit `project.settings.updated` so other services can refresh caches.
    - GitHub Issue Sync settings (`githubIssueSyncEnabled`, `githubIssueSyncState`, `githubIssueSyncIntervalMinutes`)
      are now validated via `project.schemas.ts` and persisted alongside the existing flags, with metadata columns
      (`lastGithubIssueSyncAt`, `lastGithubIssueSyncStatus`) tracked in `core/projects/settings/github-sync.ts`.
      Scheduled sync ticks from `server/src/github/sync.ts` consult these values, call `github/import.service.ts`,
      and update the metadata to avoid overlapping runs.
3. **Agent Profiles (`project.agents.routes.ts` + `project.agents.handlers.ts` + `core/agents/profiles`)**
    - CRUD endpoints emit `agent.profile.changed` to keep UI caches synced.
4. **Boards, Cards & Attempts (`board.routes.ts` + `board.*.handlers.ts`)**
    - `/projects/:projectId/board/*` and `/boards/:boardId/*` provide board state, card CRUD/move, attempts, and GitHub imports.
5. **GitHub Imports**
    - `/projects/:projectId/board/import/github/issues` (and `/boards/:boardId/import/github/issues`) call `github/import.service.ts`, which emits `github.issues.imported` after completion.

## Key Entry Points

- `core/projects/service.ts`: abstraction around project records (imported by the server adapter).
- `project.routes.ts`: project-scoped Hono routes (CRUD, settings, ticket keys, agents, attempts).
- `board.routes.ts`: board-scoped Hono routes (board state, cards, attempts, imports).
- `project.schemas.ts`: shared Zod schemas for project and board payloads.
- `core/projects/settings/service.ts`: per-project settings primitives.

## Ticket Enhancement Endpoint

- `POST /projects/:projectId/tickets/enhance`
    - Request (JSON): `{ "title": string, "description"?: string, "agent"?: string, "profileId"?: string }`
    - Response `200`: `{ "ticket": { "title": string, "description": string } }`
    - Errors: returns RFC 7807-style problem JSON with `4xx/5xx` status codes for project/agent failures.

## Open Tasks

- Move event emission out of routes and into service layer for reusability/testing.
- Add listeners reacting to `project.settings.updated` (e.g., branch template refresh).
- Provide tests for project lifecycle events and settings updates.
---
title: Server: Projects module
---
