# GitHub Module

## Purpose

- Integrate with GitHub for device-flow authentication, repository discovery, issue import, and PR creation.
- Surface GitHub-specific events so other modules (UI, projects, tasks) can react asynchronously.

## Data & Event Flow

1. **Device Flow (`routes.ts`, `auth.ts`)**
    - `/auth/github/device/start` initiates the OAuth device flow.
    - `/auth/github/device/poll` exchanges the token; on success emits `github.connected`.
    - `/auth/github/logout` revokes stored credentials and emits `github.disconnected`.
2. **Issue Import (`import.ts`)**
    - Fetches issues, creates/updates cards, and emits `github.issues.imported` with the imported count.
3. **PR Creation (`projects/routes.ts`)**
    - Attempt PR endpoint calls `createPR` and emits `github.pr.created`.

## Key Entry Points

- `auth.ts`: device-flow state machine + GitHub API calls.
- `routes.ts`: Hono endpoints for auth and repo listing (with event hooks).
- `import.ts`: github issue import and mapping management.
- `pr.ts`: PR helpers used by attempts/projects.

## Open Tasks

- Add listeners for `github.connected/disconnected/issues.imported` to refresh repo metadata caches.
- Implement background sync to reconcile issue state changes.
- Add tests for device flow edge cases and import event emission.
