# Real-time Module (WebSocket & SSE)

## Purpose

- Provide the Hono WebSocket upgrade handler for project boards.
- Provide SSE (Server-Sent Events) handlers as the primary real-time interface.
- Broadcast domain events (board changes, attempt updates, git notifications, agent/profile updates) to connected
  clients without direct coupling.

## Data & Event Flow

### WebSocket (`ws/`)

1. **Connection Lifecycle (`ws/kanban-handlers.ts`, `ws/dashboard-handlers.ts`)**
    - Board sockets (`ws/kanban-handlers.ts`):
        - Validate project/board access.
        - Send a `hello` envelope (`{"type":"hello","payload":{"serverTime":"<ISO 8601>"}}`).
        - Send the initial board `state` payload and recent attempt envelopes.
        - Handle `get_state`, card CRUD, and heartbeat (`ping`/`pong`) messages, including `update_card` commands that surface `isEnhanced` and `disableAutoCloseOnPRMerge` payloads.
    - Dashboard sockets (`ws/dashboard-handlers.ts`):
        - Register the socket on the fixed `dashboard` channel.
        - Send a `hello` envelope (`{"type":"hello","payload":{"serverTime":"<ISO 8601>"}}`).
        - Then send the latest `DashboardOverview` snapshot as `{"type":"dashboard_overview","payload":<DashboardOverview>}`.
        - The dashboard channel is read-only; incoming messages are ignored.
2. **Event Broadcasting (`ws/listeners.ts`)**
    - Subscribes to `board.state.changed`, `attempt.*`, `git.*`, `github.pr.created`, `agent.profile.changed`, and
      `agent.registered`.
    - Uses the websocket bus to broadcast typed messages defined in `shared/src/types/kanban.ts` (including `dashboard_overview` envelopes and new agent messages).
3. **Channel Management (`ws/bus.ts`)**
    - Maintains per-project socket sets and supports global fan-out (via `'*'` channel) for agent events.

### SSE (`sse/`)

1. **Connection Lifecycle (`sse/handlers.ts`)**
    - Board SSE (`sse/handlers.ts`):
        - Validates `boardId` query parameter.
        - Sends `hello` event with server timestamp.
        - Sends initial `state` payload with board snapshot.
        - Sends recent attempt statuses.
        - Sends periodic heartbeats (30s interval).
    - Dashboard SSE (`sse/handlers.ts`):
        - Global endpoint without boardId.
        - Sends `hello` event on connection.
        - Sends initial `dashboard_overview` payload.
        - Sends periodic heartbeats (30s interval).
2. **Event Broadcasting (`sse/listeners.ts`)**
    - Subscribes to the same domain events as WebSocket listeners.
    - Broadcasts events to SSE connections via the SSE bus (`sse/bus.ts`).
    - Supports per-board channels and global fan-out for agent events.
3. **Channel Management (`sse/bus.ts`)**
    - Maintains per-board connection sets.
    - Supports wildcard `'*'` channel for global broadcasts (agent events).
    - Handles connection lifecycle (add/remove on connect/disconnect).
    - Automatic cleanup of empty channels.

## Key Entry Points

### WebSocket

- `ws/kanban-handlers.ts`: handshake + command routing for board sockets.
- `ws/dashboard-handlers.ts`: dashboard overview socket (read-only).
- `ws/listeners.ts`: event-to-socket translation.
- `ws/bus.ts`: socket registry and broadcast helper.

### SSE

- `sse/handlers.ts`: SSE endpoint handler for both board and dashboard streams.
- `sse/listeners.ts`: event-to-SSE translation (mirrors ws/listeners.ts).
- `sse/bus.ts`: SSE connection registry and broadcast helper.

## Client Integration

- Client uses `useKanbanSSE` hook (`client/src/lib/sse.ts`) for board updates.
- Client uses `useDashboardSSE` hook (`client/src/lib/sse.ts`) for dashboard updates.
- Both hooks implement automatic reconnection with exponential backoff.

## Open Tasks

- Replace mutation-initiated `get_state` fetches with event-driven board diffs once available.
- Provide tests ensuring each event type broadcasts the expected real-time payload.
---
title: Server: Real-time module (WebSocket & SSE)
---
