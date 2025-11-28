# Tasks Module

## Purpose

- Provide CRUD and ordering operations for board columns and cards.
- Maintain the canonical board state consumed by the client UI.
- React to domain events (attempt lifecycle, project lifecycle) to keep board state synchronized without cross-module
  imports.

## Data & Event Flow

1. **Board State APIs**
    - `getBoardState` reads columns/cards via Drizzle and lazily ensures default columns exist.
    - Mutations (`createBoardCard`, `moveBoardCard`, `updateBoardCard`, `deleteBoardCard`) emit `card.*` and
      `board.state.changed` events after writing to the database.
2. **Event Listeners (`listeners.ts`)**
    - `project.created` → `createDefaultBoardStructure` to seed Backlog/In Progress/Review/Done columns.
    - `attempt.started` → card moves to *In Progress*.
    - `attempt.completed` → success moves to *Review*; failure/stop returns to *In Progress*.
    - `card.moved` Backlog → In Progress (when the global **Auto-start agent on In Progress** setting is enabled) → start an Attempt using the project&apos;s default agent/profile.
3. **WebSocket Handler (`ws.ts`)**
    - Only validates access and forwards create/move/update/delete to the service.
    - Real-time updates are broadcast by `ws/listeners.ts` when they observe `board.state.changed` or other events.

## Key Entry Points

- `service.ts`: database operations + event publication.
- `listeners.ts`: subscriptions that transform attempt/project events into board updates.
- `ws.ts`: thin Hono websocket hook used for initial handshake and command routing.

## Open Tasks

- Replace the follow-up fetch (`get_state`) with incremental diff streaming to reduce payload size.
- Add integration/unit tests for card movement + listener workflows.
- Support customizable workflows (column templates or per-project column titles).
