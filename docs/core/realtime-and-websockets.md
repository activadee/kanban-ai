---
title: Realtime & SSE
---

# Realtime & SSE

KanbanAI uses Server-Sent Events (SSE) as the real-time interface. SSE provides a simpler HTTP-based approach with automatic reconnection, better proxy support, and no special protocol handling. HTTP remains the source of truth; real-time interfaces push incremental updates and events so clients rarely need to refetch.

## Endpoints

### Server-Sent Events (SSE)

- Board channel:
  - `GET /api/v1/sse?boardId=<boardId>` – per-board SSE stream.
  - `boardId` may also be passed as `projectId` for compatibility.
  - Requires `boardId` query parameter.
- Dashboard channel:
  - `GET /api/v1/sse` – global dashboard SSE stream (no boardId required).

## Board channel

- Connection:
  - Client connects with `boardId` in the query string.
  - Server validates access, then:
    - Sends an initial `hello` message (`{"event":"hello","data":{"serverTime":"<ISO 8601>"}}`).
    - Sends a `state` payload with the current board snapshot (columns + cards + attempts).
      - Each card record carries `isEnhanced` so clients know which cards should render the persistent "Enhanced" badge/highlight.
- Events:
  - SSE listeners subscribe to domain events and broadcast updates:
    - `board.state.changed`
    - `attempt.*`
    - `git.*`
    - `github.pr.created`
    - `agent.profile.changed`, `agent.registered`
  - Messages are shaped according to `shared/src/types/kanban.ts` and include enough data for the client to update local state without refetching.
  - Card envelopes include `isEnhanced` and `disableAutoCloseOnPRMerge` so badges and auto-close opt-outs stay in sync with real-time updates.
- Heartbeats:
  - Server sends `heartbeat` events every 15 seconds to keep connections alive.
  - Client uses exponential backoff (1.5s base, max 12s, up to 8 attempts) for reconnection.

## Dashboard channel

- Connection:
  - Single global endpoint at `/api/v1/sse` (no query parameters).
  - On connect, the server:
    - Sends a `hello` envelope (`{"event":"hello","data":{"serverTime":"<ISO 8601>"}}`).
    - Immediately follows with the current `dashboard_overview` envelope (`{"event":"dashboard_overview","data": ... }`) that mirrors the HTTP `DashboardOverview` (metrics, active attempts, inbox items, recent activity, project snapshots, and agent stats).
    - The `dashboard_overview` payload includes normalized `timeRange` and `meta` (the same metadata object with `version` and `availableTimeRangePresets`) so both HTTP and SSE clients share the same shape.
- Updates:
  - The SSE stream is **read-only**.
  - When relevant events occur (e.g. attempts complete, boards change), listeners recompute the overview and push an updated snapshot down the stream.
- Heartbeats:
  - Server sends `heartbeat` events every 15 seconds.

## Error handling & fallbacks

- SSE uses standard HTTP, making it available in most environments including those with restrictive proxies.
- Clients should:
  - Treat real-time connections as best-effort.
  - Fall back to periodic HTTP refreshes (e.g. refetch board or dashboard queries) when the real-time connection is unavailable.

## Security & CORS

- SSE shares the same origin/host/port as the HTTP API.
- Security headers and CORS are applied to HTTP endpoints including SSE:
  - `/api/*` routes use CORS for REST.
  - SSE endpoints are standard HTTP and receive full CORS support.

## Event Types Reference

| Event | Description |
|-------|-------------|
| `hello` | Initial connection acknowledgment with server timestamp |
| `state` | Full board state snapshot |
| `heartbeat` | Keep-alive signal (every 15s) |
| `attempt_started` | New attempt initiated for a card |
| `attempt_status` | Attempt status changed |
| `attempt_log` | Log message from attempt |
| `conversation_item` | New conversation message in attempt |
| `attempt_session` | Worktree session recorded |
| `attempt_todos` | Attempt todo list updated |
| `git_status` | Git status changed |
| `git_commit` | New commit created |
| `git_push` | Changes pushed to remote |
| `attempt_pr` | Pull request created from attempt |
| `agent_profile` | Agent profile created/updated/deleted |
| `agent_registered` | New agent registered |
| `dashboard_overview` | Dashboard metrics snapshot (dashboard channel) |

For details on which events are emitted and how they relate to domain models, see:

- `core/kanban-boards-and-tasks.md`
- `core/ai-attempts.md`
- `core/git-integration.md`
