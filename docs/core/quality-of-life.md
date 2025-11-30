# Quality-of-life features

Last updated: 2025-11-28

## Auto-start agent on In Progress

- When the global **Auto-start agent on In Progress** setting is enabled:
  - Moving a card from **Backlog → In Progress** can automatically start an Attempt for that card.
- The Tasks listeners:
  - Listen for `card.moved` events.
  - Load global app settings (`autoStartAgentOnInProgress`) and project settings for the board.
  - If:
    - The move is from a Backlog column to an In Progress column, and
    - A default agent is configured for the project, and
    - There is no currently running/queued Attempt for the card,
  - Then `startAttempt` is invoked with the project’s default agent and optional default profile.
- This provides a “hands-free” way to spin up an Attempt whenever a card enters active work.
- The Card Inspector and related views listen for the resulting Attempt start events:
  - When an Attempt is auto-started, open inspectors for that card automatically subscribe to its status/messages/log
    stream so users see output in real time without refreshing.

## Auto-commit and auto-push

- Per-project repository defaults include flags to automate commits and pushes:
  - **Auto-commit on finish** – when enabled, successful Attempts trigger `attempt.autocommit.requested`.
  - **Auto-push after auto-commit** – when enabled, the auto-commit handler also pushes the branch.
- Git listeners implement this behavior:
  - On `attempt.completed` with status `succeeded`, listeners inspect project settings.
  - If automation is enabled, they publish `attempt.autocommit.requested` with worktree and remote metadata.
  - The auto-commit handler:
    - Creates a commit in the Attempt worktree (often using the latest agent message as context).
    - Optionally pushes the branch to the configured remote.
- This reduces friction when using KanbanAI as a PR factory: successful Attempts can leave behind clean, committed
  branches ready for review.

## Dependency-aware moves

- Card dependencies are enforced when moving tasks:
  - Dependencies are stored in the `card_dependencies` table.
  - `isCardBlocked(cardId)` checks whether any dependency is not in a **Done** column.
- When attempting to move a blocked card into **In Progress**:
  - The server responds with HTTP `409` and `"Task is blocked by dependencies"`.
  - The UI surfaces this as a friendly message that explains why the move is not allowed and encourages you to complete
    dependent cards first.
- This helps prevent agents or humans from starting work on tasks that are not yet unblocked.

## Realtime board sync

- Boards and Attempts are kept in sync across clients via WebSockets:
  - Board sockets listen for `board.state.changed` and other domain events (`attempt.*`, `git.*`, `github.pr.created`,
    `agent.profile.changed`, `agent.registered`).
  - The WebSocket bus broadcasts typed messages defined in `shared/src/types/kanban.ts`.
- Result:
  - Drag-and-drop moves, GitHub imports, Attempt status changes, and profile updates appear in real time for all
    connected users.

## Logging and debug traces

- The server uses a Winston-backed adapter that emits human-readable lines:
  - `LEVEL [scope] message key=value ...`
  - Scopes follow logical domains like `settings`, `github:repos`, `attempts:git`, `ws:dashboard`, `server`, etc.
  - Context is appended as key/value pairs without JSON blobs (e.g. `err="Error: failed" boardId=abc123`).
- Log level is controlled by `LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`), and can also be enabled via `KANBANAI_DEBUG` / `DEBUG` as described in `server/src/env.ts`.
- Request-level traces:
  - Hono’s logger middleware is enabled when debug logging is on:
    - `KANBANAI_DEBUG=1` or `DEBUG=*` / `DEBUG=kanbanai*` or `LOG_LEVEL=debug`.
  - When enabled, per-request lines are logged at `debug` level with the `hono` scope, for example:

```bash
DEBUG=kanbanai* LOG_LEVEL=debug bun run prod   # debug logs + Hono request lines (scope=hono)
```
