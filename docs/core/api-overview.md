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

All examples below omit the `/api/v1` prefix for brevity.

## Projects & boards

- Projects:
  - `GET  /projects` – list projects.
  - `POST /projects` – create a project from an existing or new repository.
  - `GET  /projects/:projectId` – fetch a single project/board.
  - `GET  /projects/:projectId/github/origin` – inspect GitHub origin.
  - `GET  /projects/:projectId/settings` – load per-project settings.
  - `PATCH /projects/:projectId/settings` – update per-project settings (branch, remote, defaults, inline agent/profile, optional per-inline-agent profile mapping for workflows like ticket enhancement/PR summary, automation flags, and the GitHub Issue Sync flags `githubIssueSyncEnabled`, `githubIssueSyncState` (`open`/`all`/`closed`), and `githubIssueSyncIntervalMinutes` (5–1440 minutes)).
  - `POST /projects/:projectId/tickets/enhance` – send `{title, description?, agent?, profileId?}` to the configured agent and receive `{ticket}` with rewritten text (RFC 7807 errors on failure).
  - `GET  /projects/:projectId/enhancements` – hydrate persisted enhancement entries. Returns `{ enhancements: Record<string, { status: "enhancing" | "ready", suggestion?: { title: string, description?: string } }> }` so the UI can show badges and up-to-date suggestions.
  - `PUT  /projects/:projectId/cards/:cardId/enhancement` – record a card’s enhancement status (`"enhancing"` while the job runs, `"ready"` when the agent response is available) and an optional suggestion payload.
  - `DELETE /projects/:projectId/cards/:cardId/enhancement` – clear the persisted enhancement state after acceptance, rejection, or abandonment.
- Boards:
  - `GET    /boards/:boardId` – board state (columns + cards).
  - `POST   /boards/:boardId/cards` – create a card. Responds with `{ state, cardId }` so clients can track the created card (e.g. when queuing background enhancements).
  - `PATCH  /boards/:boardId/cards/:cardId` – update card content or move cards (column + index).
  - `DELETE /boards/:boardId/cards/:cardId` – delete a card.
  - `POST   /boards/:boardId/import/github/issues` – import GitHub issues as cards.

For a project-specific view, you can also access board routes under `/projects/:projectId/board/*`.

## Attempts & git

- Attempts:
  - `POST /projects/:projectId/cards/:cardId/attempts` – start a new Attempt for a card.
  - `GET  /projects/:projectId/cards/:cardId/attempt` – fetch the latest Attempt for a card.
  - `GET  /attempts/:id` – attempt details.
  - `PATCH /attempts/:id` – stop an Attempt (`{status:"stopped"}`).
  - `POST /attempts/:id/messages` – send follow-up prompts.
  - `GET  /attempts/:id/logs` – stream logs/messages.
- Attempt-scoped Git:
  - `GET  /attempts/:id/git/status` – branch + file status for the Attempt worktree.
  - `GET  /attempts/:id/git/file` – file content.
  - `POST /attempts/:id/git/commit` – commit changes.
  - `POST /attempts/:id/git/push` – push branch.
  - `POST /attempts/:id/git/merge` – merge into the configured base branch.

These endpoints are used by the Changes dialog, Commit UI, and PR flows in the client.

## GitHub integration

- OAuth / device flow:
  - `POST /auth/github/device/start`
  - `POST /auth/github/device/poll`
  - `GET  /auth/github/check`
  - `POST /auth/github/logout`
- App configuration:
  - `GET  /auth/github/app` – current OAuth app config and origin (`db|env|unset`).
  - `PUT  /auth/github/app` – update OAuth app client ID/secret.
- Pull Requests:
  - `GET  /projects/:projectId/pull-requests` – list PRs.
  - `GET  /projects/:projectId/pull-requests/:number` – PR details.
  - `POST /projects/:projectId/pull-requests` – create a PR, optionally linking `branch`, `attemptId`, and `cardId`.
  - `POST /projects/:projectId/pull-requests/summary` – ask the configured inline agent to generate a PR title/body summary for a base/head branch pair; returns `{summary}` or RFC 7807 errors on failure.

Legacy `/projects/:projectId/github/pr` routes have been removed; all PR operations go through the project-scoped
endpoints above.

## Settings, onboarding, and agents

- Onboarding:
  - `GET  /onboarding/status`
  - `PATCH /onboarding/progress`
  - `POST /onboarding/complete`
- App settings:
  - `GET  /settings`
  - `PATCH /settings`
- Agents & profiles:
  - `GET  /agents` – list registered agents and capabilities.
  - `GET  /projects/:projectId/agents/profiles` – list profiles (project + global).
  - `POST /projects/:projectId/agents/profiles` – create a profile.
  - `PATCH /projects/:projectId/agents/profiles/:id` – update a profile.
  - `DELETE /projects/:projectId/agents/profiles/:id` – delete a profile.

## Filesystem & editor

- Filesystem:
  - `GET /fs/git-repos` – discover local Git repositories; accepts optional `path` query.
- Editor:
  - `GET  /editors` – list detected editors.
  - `POST /attempts/:id/open-editor` – open the preferred editor at the Attempt worktree path.

Editor commands emit `editor.open.requested/succeeded/failed` events that surface as system status in the UI.

## Dashboard & metrics

- Dashboard:
  - `GET /dashboard` – returns `DashboardOverview` (metrics, active attempts, recent activity, inbox, project snapshots, agent stats).
    - Supports time-range selection via query:
      - `GET /dashboard?timeRangePreset=last_24h`
      - `GET /dashboard?timeRangePreset=last_7d`
      - `GET /dashboard?from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z`
      - Convenience alias: `range=<value>` (supports `24h`, `7d`, `30d`, `90d`, `all`; each maps to the matching `timeRangePreset`).
        - `GET /dashboard?range=24h` → shorthand for `timeRangePreset=last_24h`; unknown values return HTTP `400`.
      - Precedence: explicit `from`/`to` wins, otherwise a provided `timeRangePreset` is used before `range`.
    - The `DashboardOverview.meta` object includes `availableTimeRangePresets` (allowed presets) and `version` (forward-compatible version string).
    - The handler maps these parameters into the shared `DashboardTimeRange` type and echoes it on the response.
  - WebSocket channel: `/ws/dashboard` (see realtime docs).
- Metrics:
  - `GET /metrics` – minimal Prometheus-style metrics for liveness.
  - `GET /healthz`, `GET /readyz` – health probes.

## Server metadata

- `GET /version` – returns `{currentVersion, latestVersion, updateAvailable, checkedAt}`.
  - `currentVersion` is derived from `KANBANAI_VERSION` or the nearest `kanban-ai` `package.json`.
  - `latestVersion` is fetched from GitHub Releases (`KANBANAI_UPDATE_REPO`, `KANBANAI_UPDATE_TOKEN`), cached for ~15 minutes, and falls back to `currentVersion` when the lookup fails.
  - `updateAvailable` lets clients know when a newer release exists so UI can prompt for restart.

For realtime message shapes and WebSocket usage, see `core/realtime-and-websockets.md`.
