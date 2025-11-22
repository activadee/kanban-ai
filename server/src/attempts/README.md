# Attempts Module

## Purpose

- Manage the lifecycle of agent attempts (create, resume, stop) against project cards.
- Persist attempt metadata, logs, and conversation history in SQLite via Drizzle.
- Coordinate worktree provisioning and teardown while remaining decoupled through the event bus.

## Data & Event Flow

1. **Start / Resume**
    - `startAttempt` / `followupAttempt` resolve project settings, ensure worktree paths, and enqueue the run.
    - The async runner streams structured JSONL from the agent. Each message is persisted and emitted as an event:
        - `attempt.queued` → `attempt.started` → `attempt.status.changed` updates.
        - `attempt.log.appended`, `attempt.conversation.appended`, `attempt.session.recorded` for telemetry/UI.
    - Worktree creation calls `createWorktree(..., { projectId, attemptId })` which raises `worktree.created`.
2. **Completion**
    - Runner emits `attempt.completed` with final status. Git auto-commit is delegated via
      `attempt.autocommit.requested` (handled by the git listener).
    - On abort, `attempt.stopped` fires and the status transitions to `stopping/stopped`.
3. **Git Helpers**
    - Attempt routes proxy to the git service (`commitAtPath`, etc.) with metadata so those helpers emit
      `git.*` events automatically.
4. **Editor**
    - `/attempts/:id/open-editor` emits `editor.open.requested/succeeded/failed` and returns diagnostics.

## Key Entry Points

- `service.ts`: attempt lifecycle logic and event emission.
- `routes.ts`: HTTP routes for attempts, git actions, follow-ups, and editor launch.
- `autocommit.ts`: shared handler invoked by git listener for `attempt.autocommit.requested`.

## Open Tasks

- Add unit/integration tests covering attempt events (success, failure, stop).
- Extend stop handling to cancel background processes and surface status in UI.
- Consider resumable state caching for long-running agents.
