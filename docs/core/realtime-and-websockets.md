---
title: Realtime & WebSockets
---

# Realtime & WebSockets

KanbanAI uses WebSockets for live board updates and a streaming dashboard. HTTP remains the source of truth; sockets
push incremental updates and events so clients rarely need to refetch.

## Endpoints

- Board channel:
  - `GET /api/v1/ws?boardId=<boardId>` – per-board socket.
  - `boardId` may also be passed as `projectId` for compatibility.
- Dashboard channel:
  - `GET /api/v1/ws/dashboard` – global dashboard socket.

Both use the same WebSocket infrastructure but different handlers and message types.

## Board channel

- Connection:
  - Client connects with `boardId` in the query string.
  - Server validates access, then:
    - Sends an initial `hello` message.
    - Sends a `state` payload with the current board snapshot (columns + cards + attempts).
      - Each card record now carries `isEnhanced` so clients know which cards should render the persistent “Enhanced” badge/highlight.
- Commands:
  - Board sockets accept commands for:
    - Creating/updating/deleting cards.
    - Moving cards between columns.
      - `update_card` payload now accepts an optional `isEnhanced` boolean to mirror enhancement state updates.
  - Handlers validate and forward these commands to the Tasks service; REST and WebSockets share the same underlying
    board logic.
- Events:
  - WebSocket listeners subscribe to domain events and broadcast updates:
    - `board.state.changed`
    - `attempt.*`
    - `git.*`
    - `github.pr.created`
    - `agent.profile.changed`, `agent.registered`
  - Messages are shaped according to `shared/src/types/kanban.ts` and include enough data for the client to update local
    state without refetching.
    - Card envelopes now include `isEnhanced` so badges stay in sync with real-time updates and the badge toggles can be triggered via sockets too.

## Dashboard channel

- Connection:
  - Single global channel at `/api/v1/ws/dashboard`.
  - On connect, the server:
    - Sends a `hello` envelope (e.g. `{"type":"hello","payload":{"serverTime":"<ISO 8601>"}}`).
    - Immediately follows with the current `dashboard_overview` envelope (`{"type":"dashboard_overview","payload": ... }`) that mirrors the HTTP `DashboardOverview` (metrics, active attempts, inbox items, recent activity, project snapshots, and agent stats).
    - The `dashboard_overview.payload` includes normalized `timeRange` and `meta` (the same metadata object with `version` and `availableTimeRangePresets`) so both HTTP and WS clients share the same shape.
- Updates:
  - The Dashboard socket is **read-only**:
    - Incoming messages are ignored.
  - When relevant events occur (e.g. attempts complete, boards change), listeners recompute the overview and push an
    updated snapshot down the socket.

## Error handling & fallbacks

- If WebSocket support is not configured (e.g. in certain environments), the server responds with:
  - HTTP `503` and a problem+json payload indicating WebSockets are unavailable.
- Clients should:
  - Treat sockets as best-effort realtime.
  - Fall back to periodic HTTP refreshes (e.g. refetch board or dashboard queries) when the socket is unavailable.

## Security & CORS

- WebSockets share the same origin/host/port as the HTTP API.
- Security headers and CORS are applied only to HTTP:
  - `/api/*` routes use CORS for REST.
  - WebSocket upgrade paths are explicitly skipped by security/CORS middleware.

For details on which events are emitted and how they relate to domain models, see:

- `core/kanban-boards-and-tasks.md`
- `core/ai-attempts.md`
- `core/git-integration.md`
