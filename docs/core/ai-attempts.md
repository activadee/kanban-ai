# AI Attempts (agentic runs)

Last updated: 2025-11-28

## What an Attempt is

- An **Attempt** is a single agent run tied to a specific card on a project’s board.
- Attempts encapsulate:
  - Status (`queued`, `running`, `stopping`, `succeeded`, `failed`, `stopped`).
  - Associated project/board/card identifiers.
  - Git worktree path and branch information.
  - Logs and conversation history (stored as structured JSONL).
- All Attempt data is stored in SQLite via Drizzle ORM, with types exported from the `shared` package.

## Lifecycle and events

- Attempts are created and controlled via the Attempts service and routes:
  - `POST /projects/:projectId/cards/:cardId/attempts` – start a new Attempt.
  - `GET /projects/:projectId/cards/:cardId/attempt` – fetch the latest Attempt for a card.
  - `GET /attempts/:id` – detailed Attempt info.
  - `PATCH /attempts/:id` with `{ status: "stopped" }` – request graceful stop.
  - `POST /attempts/:id/messages` – send follow-up prompts into an existing Attempt.
  - `GET /attempts/:id/logs` – stream Attempt logs.
- The underlying runner emits a stream of events:
  - `attempt.queued`
  - `attempt.started`
  - `attempt.status.changed`
  - `attempt.log.appended`
  - `attempt.conversation.appended`
  - `attempt.session.recorded`
  - `attempt.todos.updated`
  - `attempt.completed`
  - `attempt.autocommit.requested`
  - `attempt.stopped`
- WebSocket listeners subscribe to these events and forward them to connected clients so the board, Attempts panel,
  messages, and logs stay in sync.

## Worktrees and isolation

- Every Attempt runs inside a dedicated Git worktree:
  - Located under `$HOME/.kanbanAI/worktrees/<project>/<attempt>/...`.
- When starting or resuming an Attempt, the service:
  - Ensures the base project repository is present.
  - Creates a new worktree and branch if needed.
  - Emits `worktree.created` with metadata (project, attempt, paths).
- Cleanup:
  - When a card is moved to **Done** and its Attempt is finished, a listener calls `cleanupCardWorkspace`, which removes
    the worktree and deletes its branch.
  - After successful cleanup, the Attempt row remains in the database but its `worktreePath` field is set to `NULL` so
    completed Attempts no longer claim a live worktree on disk.
  - When a project is deleted, Filesystem listeners purge all worktrees for that repository.

## Conversations, processes, and logs

- The client surfaces Attempt activity through three main views:
  - **Messages** – live conversation with the agent; uses `attempt.conversation.appended` events.
  - **Processes** – summaries of dev/automation processes (e.g. project dev scripts), including controls to re-run or
    stop them.
  - **Logs** – structured log output, including script output and internal diagnostics via `attempt.log.appended`.
  - **Todos panel** – a read‑only list of the latest AI‑generated todos for the Attempt, shown next to **Open editor**
    as `<completed>/<total> Todos`; it is powered by `attempt.todos.updated` events and is kept separate from assistant
    messages so todo text is never reused as commit message content.
- Follow-up prompts:
  - Sent via `POST /attempts/:id/messages`.
  - Reuse the same Attempt session so the agent can use prior context.
  - Can include pasted or drag‑dropped image attachments from the UI.
    - Supported formats: PNG, JPEG, WebP.
    - Limits: up to 4 images per follow‑up, 5MB each.
    - Vision‑capable agents (e.g., Codex) receive images for processing; text‑only agents ignore them gracefully.
- Stopping Attempts:
  - `PATCH /attempts/:id` with `status: "stopped"` triggers `attempt.stopped`.
  - The runner and listeners update status so the UI shows the Attempt as stopped.

## Git & PR integration for Attempts

- Attempt worktrees expose Git operations through dedicated endpoints:
  - `GET /attempts/:id/git/status`
  - `GET /attempts/:id/git/file`
  - `POST /attempts/:id/git/commit`
  - `POST /attempts/:id/git/push`
  - `POST /attempts/:id/git/merge`
- The UI uses these to power the Changes dialog, Commit flow, and merge helpers for Attempt branches.
- Pull Requests:
  - `POST /projects/:projectId/pull-requests` can be called with `branch`, `attemptId`, and `cardId` so PRs are tied
    back to the originating Attempt and card.
  - Older attempt-specific PR routes have been removed; everything flows through project-scoped PR endpoints.
