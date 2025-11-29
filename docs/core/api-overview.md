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
  - `PATCH /projects/:projectId/settings` – update per-project settings (branch, remote, defaults, inline agent/profile, automation flags).
  - `POST /projects/:projectId/tickets/enhance` – send `{title, description?, agent?, profileId?}` to the configured agent and receive `{ticket}` with rewritten text (RFC 7807 errors on failure).
  - Subtasks (per ticket):
    - `GET    /projects/:projectId/tickets/:cardId/subtasks` – list subtasks for a ticket, ordered by `position`, with `{ticketId, subtasks, progress}`.
    - `POST   /projects/:projectId/tickets/:cardId/subtasks` – create a subtask under a ticket.
    - `PATCH  /projects/:projectId/subtasks/:subtaskId` – update a subtask (title, description, status, assignee, due date).
    - `DELETE /projects/:projectId/subtasks/:subtaskId` – delete a subtask.
    - `PATCH  /projects/:projectId/tickets/:cardId/subtasks/reorder` – reorder subtasks by passing `{orderedIds: string[]}`.
- Boards:
  - `GET    /boards/:boardId` – board state (columns + cards).
  - `POST   /boards/:boardId/cards` – create a card.
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
  - `GET /dashboard` – returns `DashboardOverview` (metrics, active attempts, recent activity, project snapshots).
  - WebSocket channel: `/ws/dashboard` (see realtime docs).
- Metrics:
  - `GET /metrics` – minimal Prometheus-style metrics for liveness.
  - `GET /healthz`, `GET /readyz` – health probes.

For realtime message shapes and WebSocket usage, see `core/realtime-and-websockets.md`.
