# Real-time Module (SSE)

## Purpose

- Provide SSE (Server-Sent Events) handlers as the primary real-time interface.
- Broadcast domain events (board changes, attempt updates, git notifications, agent/profile updates) to connected clients without direct coupling.

## Data & Event Flow

### SSE (`sse/`)

1. **Connection Lifecycle (`sse/handlers.ts`)**
    - Board SSE (`sse/handlers.ts`):
        - Validates `boardId` query parameter.
        - Sends `hello` event with server timestamp.
        - Sends initial `state` payload with board snapshot.
        - Sends recent attempt statuses.
        - Sends periodic heartbeats (15s interval).
    - Dashboard SSE (`sse/handlers.ts`):
        - Global endpoint without boardId.
        - Sends `hello` event on connection.
        - Sends initial `dashboard_overview` payload.
        - Sends periodic heartbeats (15s interval).
2. **Event Broadcasting (`sse/listeners.ts`)**
    - Subscribes to `board.state.changed`, `attempt.*`, `git.*`, `github.pr.created`, `agent.profile.changed`, and `agent.registered`.
    - Broadcasts events to SSE connections via the SSE bus (`sse/bus.ts`).
    - Supports per-board channels and global fan-out for agent events.
3. **Channel Management (`sse/bus.ts`)**
    - Maintains per-board connection sets.
    - Supports wildcard `'*'` channel for global broadcasts (agent events).
    - Handles connection lifecycle (add/remove on connect/disconnect).
    - Automatic cleanup of empty channels.

## Key Entry Points

- `sse/handlers.ts`: SSE endpoint handler for both board and dashboard streams.
- `sse/listeners.ts`: event-to-SSE translation.
- `sse/bus.ts`: SSE connection registry and broadcast helper.

## Client Integration

- Client uses `useKanbanSSE` hook (`client/src/lib/sse.ts`) for board updates.
- Client uses `useDashboardSSE` hook (`client/src/lib/sse.ts`) for dashboard updates.
- Both hooks implement automatic reconnection with exponential backoff (1.5s base, max 12s, up to 8 attempts).

## Message Types

SSE messages use the `SseMsg` type defined in `shared/src/types/kanban.ts`:

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

## Open Tasks

- Provide tests ensuring each event type broadcasts the expected real-time payload.
---
title: Server: Real-time module (SSE)
---
