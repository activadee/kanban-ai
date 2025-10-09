# Editor Module

## Purpose

- Detect available editors, build launch commands, and open worktree paths for attempts.
- Emit editor open events so the UI can reflect success or failure.

## Data & Event Flow

1. **Service (`service.ts`)**
    - `openEditorAtPath` resolves the preferred editor from global settings, constructs the command, and spawns it
      detached.
    - Detection helpers (`detectEditors`) identify installed binaries.
2. **Routes (`routes.ts`)**
    - `/editors` lists detected editors.
    - `/attempts/:id/open-editor` (in attempts module) wraps this service and emits
      `editor.open.requested/succeeded/failed` around the call.

## Key Entry Points

- `service.ts`: all detection/spawn logic and diagnostics.
- Integrated via attempts route for launching worktrees.

## Open Tasks

- Capture PID/metadata on successful launches (when available) and include in events.
- Add listener to surface failure events in the UI with user-friendly messaging.
- Provide tests around command resolution and environment detection.
