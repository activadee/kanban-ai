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
3. **Issue Export on Ticket Create (`export.service.ts`)**
    - When `githubIssueAutoCreateEnabled` is true and a user checks **Create GitHub Issue** in the Create Ticket dialog, the board card creation handler calls `createGithubIssueForCard`.
    - The service resolves the project’s GitHub origin, creates an issue via the REST API, and stores a `github_issues` mapping with `direction = 'exported'`.
3. **Background Issue Sync (`sync.ts`)**
    - Lightweight scheduler started from the server entrypoints.
    - On a fixed tick, enumerates projects with GitHub Issue Sync enabled and a valid GitHub connection, resolves the GitHub origin (`owner/repo`), and invokes `importGithubIssues` with the configured state (`open`/`all`/`closed`).
    - Stores per-project sync metadata (`lastGithubIssueSyncAt`, `lastGithubIssueSyncStatus`) in `project_settings` to avoid overlapping runs and to respect the configured interval.
4. **PR Creation (`projects/routes.ts`)**
    - Attempt PR endpoint calls `createPR` and emits `github.pr.created`.
5. **Background PR Auto‑Close (`pr-auto-close.sync.ts`)**
    - Scheduler started from the server entrypoints, sharing the same tick cadence as issue sync.
    - For projects with `autoCloseTicketOnPRMerge` enabled, periodically checks cards in the **Review** column that have a linked `prUrl`.
    - If the PR is closed and merged, moves the card to **Done** unless `disableAutoCloseOnPRMerge` is set on that card.
    - Requires columns titled **Review** and **Done** (detected by title).
    - Emits `github.pr.merged.autoClosed` and logs under `github:pr-auto-close`.

## Key Entry Points

- `github-client.ts`: low-level GitHub HTTP client (device flow, user info, REST helpers).
- `auth.service.ts`: device-flow state machine using `github-client` + `githubRepo`.
- `auth.routes.ts` / `app-config.routes.ts`: Hono endpoints for auth, app config, and repo listing (with event hooks).
- `import.service.ts`: GitHub issue import and mapping management (used by both manual imports and scheduled sync).
- `export.service.ts`: Creates GitHub issues for newly created cards and persists exported mappings.
- `sync.ts`: background scheduler that drives recurring issue sync for eligible projects.
- `pr-auto-close.sync.ts`: background scheduler that auto‑closes Review cards when their PRs are merged.
- `pr.ts`: PR helpers used by attempts/projects via `github-client`.

## Open Tasks

- Add listeners for `github.connected/disconnected/issues.imported` to refresh repo metadata caches.
- Add tests for device flow edge cases and import event emission.
---
title: Server: GitHub module
---
