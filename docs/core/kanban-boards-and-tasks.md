# Kanban boards & tasks

Last updated: 2025-11-30

## Board model

- Each project owns a single **board** representing its workflow.
- Boards are backed by `boards`, `columns`, and `cards` tables in SQLite and exposed via:
  - `/boards/:boardId/*`
  - `/projects/:projectId/board/*`
- The Tasks module is responsible for:
  - Creating and maintaining the canonical board state.
  - Emitting `board.state.changed` and `card.*` events after mutations.

### Default columns

- When a project is created, a Tasks listener seeds a default four-column workflow:
  - **Backlog**
  - **In Progress**
  - **Review**
  - **Done**
- Column titles are stored in the database and can be changed in future workflow customisation work, but the default
  behavior assumes these names when determining where to move cards on Attempt events.

## Cards, ticket keys, and details

- **Cards** represent tasks on the board. Each card has:
  - `title`
  - `description` (optional)
  - `ticketKey` (optional, e.g. `ABC-123`, often derived from GitHub issues)
  - `dependsOn` relationships to other cards on the same board
- On the board itself, cards are rendered in a compact form showing only the `title` to maximise vertical space.
- Blocked cards that are still waiting on dependencies wrap that compact view in a tooltip listing the blockers so you can see what is pending without opening the inspector.
- The “card inspector” in the UI lets you edit these fields, with the ticket key surfaced prominently for quick scanning.

### Ordering and moves

- Cards are ordered within a column using an integer index.
- Moves are performed via a single endpoint:
  - `PATCH /boards/:boardId/cards/:cardId` with `columnId` and `index`.
- The server:
  - Validates the target column belongs to the board.
  - Updates indices in the source and target columns.
  - Returns the updated card plus fresh column snapshots so the UI can update without a full board reload.

## Task dependencies and blocking

- Dependencies are stored in a `card_dependencies` table (`card_id`, `depends_on_card_id`) and managed by the
  `core/projects/dependencies` helpers.
- Rules enforced by the server:
  - A card can only depend on other cards on the same board.
  - Cycles are prevented (attempting to create them returns a validation error).
  - When calculating whether a card is **blocked**, any dependency not in a **Done** column is considered incomplete.
- When you try to move a blocked card into **In Progress**:
  - The Projects handlers call `isCardBlocked(cardId)`.
  - If `blocked` is `true`, the API responds with HTTP `409` and detail `"Task is blocked by dependencies"`.
  - The UI uses this status to show a clear toast explaining that dependencies must be completed first.

## Automatic column transitions

- Board state reacts to Attempt lifecycle events:
  - `attempt.started` → Tasks listener moves the card into **In Progress**.
  - `attempt.completed`:
    - If status is `succeeded` → card moves into **Review**.
    - If status is `failed` or `stopped` → card moves back to **In Progress**.
- When a card is moved into **Done`**:
  - A Tasks listener triggers workspace cleanup for the associated Attempt (removing its worktree and branch).

## Real-time updates

- The WebSocket module maintains per-board channels that:
  - Validate access and send an initial `state` snapshot on connect.
  - Accept commands for create / move / update / delete, which are forwarded to the Tasks service.
- Separate listeners subscribe to domain events and broadcast updates:
  - `board.state.changed`
  - `attempt.*`
  - `git.*`
  - `github.pr.created`
  - `agent.profile.changed`, `agent.registered`
- Clients use these WebSocket messages to keep boards, task details, and Attempt status in sync in real time, without
  manual refresh.
