# Attempts Module

## Purpose

- Manage the lifecycle of agent attempts (create, resume, stop) against project cards.
- Persist attempt metadata, logs, and conversation history in SQLite via Drizzle ORM.
- Coordinate worktree provisioning and teardown while remaining decoupled through the event bus.

## Data & Event Flow

1. **Start / Resume**
    - `startAttempt` / `followupAttempt` resolve project settings, ensure worktree paths, and enqueue the run.
    - The async runner streams structured JSONL from the agent. Each message is persisted and emitted as an event:
        - `attempt.queued` → `attempt.started` → `attempt.status.changed` updates.
        - `attempt.log.appended`, `attempt.conversation.appended`, `attempt.session.recorded` for telemetry/UI.
    - Follow-up requests now allow optional image attachments: the handler validates PNG/JPEG/WebP (max four files, 5 MB each), requires either a prompt or at least one image, and enforces a request-body size cap before parsing. Attachments are persisted to disk under `.kanbanai/attachments/<attemptId>` and conversation history stores lightweight URLs (`/api/v1/attempts/:id/attachments/<file>`) rather than full base64 data URLs, keeping DB and event-stream payloads small. Vision-capable runtimes can still receive local file paths (`ctx.images`) and agents that accept base64 (e.g., OpenCode) still receive `ctx.attachments` in-memory for that turn.
    - Worktree creation calls `createWorktree(..., { projectId, attemptId })` which raises `worktree.created`.
2. **Completion**
    - Runner emits `attempt.completed` with final status. Git auto-commit is delegated via
      `attempt.autocommit.requested` (handled by the git listener).
    - On abort, `attempt.stopped` fires and the status transitions to `stopping/stopped`.
    - When a card is moved to **Done** and its attempt is finished, a tasks listener tears down the attempt worktree and deletes its branch.
    - As part of this cleanup, `attempts.worktree_path` is explicitly set to `NULL` so completed Attempts can remain in
      the database without pointing at a deleted directory on disk.
3. **Git Helpers**
    - Attempt routes proxy to the git service (`commitAtPath`, etc.) with metadata so those helpers emit
      `git.*` events automatically.
4. **Editor**
    - `/attempts/:id/open-editor` emits `editor.open.requested/succeeded/failed` and returns diagnostics.

## Key Entry Points

- `service.ts`: attempt lifecycle logic and event emission.
- `routes.ts`: HTTP router wiring for attempts, git actions, follow-ups, and editor launch.
- `attempts.handlers.ts`: attempt lifecycle/log handlers (details, stop, logs, follow-ups, automation).
- `attempts.editor.handlers.ts`: editor launch handler for `/attempts/:id/open-editor`.
- `attempts.git.handlers.ts`: git helpers scoped to attempt worktrees (status, file, commit, push, merge).
- `attempts.pr.handlers.ts`: pull request helper handlers for attempt branches.
- `autocommit.ts`: shared handler invoked by git listener for `attempt.autocommit.requested`.

## Open Tasks

- Add unit/integration tests covering attempt events (success, failure, stop).
- Extend stop handling to cancel background processes and surface status in UI.
- Consider resumable state caching for long-running agents.
---
title: Server: Attempts module
---
