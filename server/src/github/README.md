# GitHub Module

## Purpose

- Integrate with GitHub for device-flow authentication, repository discovery, issue import, and PR creation.
- Surface GitHub-specific events so other modules (UI, projects, tasks) can react asynchronously.

## Data & Event Flow

1. **Device Flow (`auth.routes.ts`, `auth.service.ts`)**
    - `/auth/github/device/start` initiates the OAuth device flow.
    - `/auth/github/device/poll` exchanges the token; on success emits `github.connected`.
    - `/auth/github/logout` revokes stored credentials and emits `github.disconnected`.
2. **Issue Import (`import.service.ts`)**
    - Fetches issues, creates/updates cards, and emits `github.issues.imported` with the imported count.
3. **PR Creation (`projects/routes.ts`)**
    - Attempt PR endpoint calls `createPR` and emits `github.pr.created`.

## Key Entry Points

- `github-client.ts`: low-level GitHub HTTP client (device flow, user info, REST helpers).
- `auth.service.ts`: device-flow state machine using `github-client` + `githubRepo`.
- `auth.routes.ts` / `app-config.routes.ts`: Hono endpoints for auth, app config, and repo listing (with event hooks).
- `import.service.ts`: GitHub issue import and mapping management.
- `pr.ts`: PR helpers used by attempts/projects via `github-client`.

## Open Tasks

- Add listeners for `github.connected/disconnected/issues.imported` to refresh repo metadata caches.
- Implement background sync to reconcile issue state changes.
- Add tests for device flow edge cases and import event emission.
