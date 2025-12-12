---
title: API overview
---

# API overview

KanbanAI exposes a JSON HTTP API and a small WebSocket interface under a versioned `/api/v1` prefix (with a legacy `/api`
shim). This page gives a high-level map of the main resources and how they fit together.

## Base URLs

- REST:
  - Development (default): `http://localhost:3000/api/v1`
  - Legacy shim: `http://localhost:3000/api`
- WebSocket:
  - Board channel: `ws://localhost:3000/api/v1/ws?boardId=<boardId>`
  - Dashboard channel: `ws://localhost:3000/api/v1/ws/dashboard`

All endpoints below are rooted at `/api/v1`; paths are shown with the full prefix for clarity.

## Projects & boards

- Projects:
  - `GET  /api/v1/projects` – list projects.
  - `POST /api/v1/projects` – create a project from an existing or new repository.
  - `GET  /api/v1/projects/:projectId` – fetch a single project/board.
  - `GET  /api/v1/projects/:projectId/github/origin` – inspect GitHub origin.
  - `GET  /api/v1/projects/:projectId/settings` – load per-project settings.
  - `PATCH /api/v1/projects/:projectId/settings` – update per-project settings (branch, remote, defaults, inline agent/profile, optional per-inline-agent profile mapping for workflows like ticket enhancement/PR summary, automation flags, failure tolerance toggles `allowScriptsToFail`, `allowCopyFilesToFail`, `allowSetupScriptToFail`, `allowDevScriptToFail`, `allowCleanupScriptToFail`, and GitHub Issue settings: `githubIssueSyncEnabled`, `githubIssueSyncState` (`open`/`all`/`closed`), `githubIssueSyncIntervalMinutes` (5–1440 minutes), and `githubIssueAutoCreateEnabled`).
  - `POST /api/v1/projects/:projectId/tickets/enhance` – send `{title, description?, agent?, profileId?}` to the configured agent and receive `{ticket}` with rewritten text (RFC 7807 errors on failure).
  - `GET  /api/v1/projects/:projectId/enhancements` – hydrate persisted enhancement entries. Returns `{ enhancements: Record<string, { status: "enhancing" | "ready", suggestion?: { title: string, description?: string } }> }` so the UI can show badges and up-to-date suggestions.
  - `PUT  /api/v1/projects/:projectId/cards/:cardId/enhancement` – record a card’s enhancement status (`"enhancing"` while the job runs, `"ready"` when the agent response is available) and an optional suggestion payload.
  - `DELETE /api/v1/projects/:projectId/cards/:cardId/enhancement` – clear the persisted enhancement state after acceptance, rejection, or abandonment.
- Boards:
  - `GET    /api/v1/boards/:boardId` – board state (columns + cards).
  - `POST   /api/v1/boards/:boardId/cards` – create a card. Accepts optional `createGithubIssue: boolean` (only effective when `githubIssueAutoCreateEnabled` is on). Responds with `{ state, cardId, githubIssueError? }`.
  - `PATCH  /api/v1/boards/:boardId/cards/:cardId` – update card content or move cards (column + index).
  - `DELETE /api/v1/boards/:boardId/cards/:cardId` – delete a card.
  - `POST   /api/v1/boards/:boardId/import/github/issues` – import GitHub issues as cards.
  - `GET    /api/v1/boards/:boardId/github/issues/stats` – counts linked issues by direction (`imported`, `exported`, `total`).

For a project-specific view, you can also access board routes under `/api/v1/projects/:projectId/board/*`.

## Attempts & git

- Attempts:
  - `POST /api/v1/projects/:projectId/cards/:cardId/attempts` – start a new Attempt for a card.
  - `GET  /api/v1/projects/:projectId/cards/:cardId/attempt` – fetch the latest Attempt for a card.
  - `GET  /api/v1/attempts/:id` – attempt details.
  - `PATCH /api/v1/attempts/:id` – stop an Attempt (`{status:"stopped"}`).
  - `POST /api/v1/attempts/:id/messages` – send follow-up prompts.
  - `GET  /api/v1/attempts/:id/logs` – stream logs/messages.
- Attempt-scoped Git:
  - `GET  /api/v1/attempts/:id/git/status` – branch + file status for the Attempt worktree.
  - `GET  /api/v1/attempts/:id/git/file` – file content.
  - `POST /api/v1/attempts/:id/git/commit` – commit changes.
  - `POST /api/v1/attempts/:id/git/push` – push branch.
  - `POST /api/v1/attempts/:id/git/merge` – merge into the configured base branch.

These endpoints are used by the Changes dialog, Commit UI, and PR flows in the client.

## GitHub integration

- OAuth / device flow:
  - `POST /api/v1/auth/github/device/start`
  - `POST /api/v1/auth/github/device/poll`
  - `GET  /api/v1/auth/github/check`
  - `POST /api/v1/auth/github/logout`
- App configuration:
  - `GET  /api/v1/auth/github/app` – current OAuth app config and origin (`db|env|unset`).
  - `PUT  /api/v1/auth/github/app` – update OAuth app client ID/secret.
- Pull Requests:
  - `GET  /api/v1/projects/:projectId/pull-requests` – list PRs.
  - `GET  /api/v1/projects/:projectId/pull-requests/:number` – PR details.
  - `POST /api/v1/projects/:projectId/pull-requests` – create a PR, optionally linking `branch`, `attemptId`, and `cardId`.
  - `POST /api/v1/projects/:projectId/pull-requests/summary` – ask the configured inline agent to generate a PR title/body summary for a base/head branch pair; returns `{summary}` or RFC 7807 errors on failure.

Legacy `/projects/:projectId/github/pr` routes have been removed; all PR operations go through the project-scoped
endpoints above.

## Settings, onboarding, and agents

- Onboarding:
  - `GET  /api/v1/onboarding/status`
  - `PATCH /api/v1/onboarding/progress`
  - `POST /api/v1/onboarding/complete`
- App settings:
  - `GET  /api/v1/settings`
  - `PATCH /api/v1/settings`
- Agents & profiles:
  - `GET  /api/v1/agents` – list registered agents and capabilities.
  - `GET  /api/v1/projects/:projectId/agents/profiles` – list profiles (project + global).
  - `POST /api/v1/projects/:projectId/agents/profiles` – create a profile.
  - `PATCH /api/v1/projects/:projectId/agents/profiles/:id` – update a profile.
  - `DELETE /api/v1/projects/:projectId/agents/profiles/:id` – delete a profile.

## Filesystem & editor

- Filesystem:
  - `GET /api/v1/fs/git-repos` – discover local Git repositories; accepts optional `path` query.
- Editor:
  - `GET  /api/v1/editors` – list detected editors.
  - `POST /api/v1/attempts/:id/open-editor` – open the preferred editor at the Attempt worktree path.

Editor commands emit `editor.open.requested/succeeded/failed` events that surface as system status in the UI.

## Dashboard & metrics

- Dashboard:
  - `GET /api/v1/dashboard` – returns `DashboardOverview` (metrics, active attempts, recent activity, inbox, project snapshots, agent stats).
    - Supports time-range selection via query:
      - `GET /api/v1/dashboard?timeRangePreset=last_24h`
      - `GET /api/v1/dashboard?timeRangePreset=last_7d`
      - `GET /api/v1/dashboard?from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z`
      - Convenience alias: `range=<value>` (supports `24h`, `7d`, `30d`, `90d`, `all`; each maps to the matching `timeRangePreset`).
        - `GET /api/v1/dashboard?range=24h` → shorthand for `timeRangePreset=last_24h`; unknown values return HTTP `400`.
      - Precedence: explicit `from`/`to` wins, otherwise a provided `timeRangePreset` is used before `range`.
    - The `DashboardOverview.meta` object includes `availableTimeRangePresets` (allowed presets) and `version` (forward-compatible version string).
    - The handler maps these parameters into the shared `DashboardTimeRange` type and echoes it on the response.
  - WebSocket channel: `GET /api/v1/ws/dashboard` (see realtime docs).
- Metrics:
  - `GET /api/v1/metrics` – minimal Prometheus-style metrics for liveness.
  - `GET /api/v1/healthz`, `GET /api/v1/readyz` – health probes.

## Server metadata

- `GET /api/v1/version` – returns `{currentVersion, latestVersion, updateAvailable, checkedAt}`.
  - `currentVersion` is derived from `KANBANAI_VERSION` or the nearest `kanban-ai` `package.json`.
  - `latestVersion` is fetched from GitHub Releases (`KANBANAI_UPDATE_REPO`, `KANBANAI_UPDATE_TOKEN`), cached for ~15 minutes, and falls back to `currentVersion` when the lookup fails.
  - `updateAvailable` lets clients know when a newer release exists so UI can prompt for restart.

For realtime message shapes and WebSocket usage, see `core/realtime-and-websockets.md`.
