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
- Commands:
  - Board sockets accept commands for:
    - Creating/updating/deleting cards.
    - Moving cards between columns.
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

## Dashboard channel

- Connection:
  - Single global channel at `/api/v1/ws/dashboard`.
  - On connect, the server:
    - Sends `hello`.
    - Computes and sends the current `DashboardOverview` (metrics, active attempts, recent activity, project snapshots).
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

