# WebSocket Module

## Purpose

- Provide the Hono websocket upgrade handler for project boards.
- Broadcast domain events (board changes, attempt updates, git notifications, agent/profile updates) to connected
  clients without direct coupling.

## Data & Event Flow

1. **Connection Lifecycle (`tasks/ws.ts`)**
    - Validates project access, sends `hello` and initial `state` payload, then delegates create/move/update/delete
      commands to the tasks service.
2. **Event Broadcasting (`ws/listeners.ts`)**
    - Subscribes to `board.state.changed`, `attempt.*`, `git.*`, `github.pr.created`, `agent.profile.changed`, and
      `agent.registered`.
    - Uses the websocket bus to broadcast typed messages defined in `shared/src/types/kanban.ts` (new agent messages
      included).
3. **Channel Management (`ws/bus.ts`)**
    - Maintains per-project socket sets and supports global fan-out (via `'*'` channel) for agent events.

## Key Entry Points

- `tasks/ws.ts`: handshake + command routing.
- `ws/listeners.ts`: event-to-socket translation.
- `ws/bus.ts`: socket registry and broadcast helper.

## Open Tasks

- Replace mutation-initiated `get_state` fetches with event-driven board diffs once available.
- Add heartbeats / reconnect/backoff strategy for more resilient connections.
- Provide tests ensuring each event type broadcasts the expected websocket payload.
