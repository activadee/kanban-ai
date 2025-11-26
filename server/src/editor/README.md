# Editor Module

## Purpose

- Detect available editors, build launch commands, and open worktree paths for attempts.
- Emit editor open events so the UI can reflect success or failure.

## Data & Event Flow

1. **Detection (`detect.ts`)**
    - `detectEditors` inspects registered adapters and reports installed editors.
    - `getAdapterForKey` resolves a concrete adapter from an editor key with sensible fallback.
2. **Environment (`env.ts`)**
    - `createDesktopEnv` derives a baseline GUI-friendly environment (PATH, DISPLAY, XDG runtime, DBUS).
    - `loadUserSessionEnv` and `applySessionEnv` merge in session environment (e.g. systemd user env on Linux).
    - `buildEditorEnv` produces the final environment for a specific editor key.
3. **Open (`open.ts`)**
    - `openEditorAtPath` resolves the preferred editor from settings, builds the command, and spawns it detached with
      a fallback shell command when needed.
4. **Service façade (`service.ts`)**
    - Re-exports `detectEditors`, `openEditorAtPath`, and related helpers for external callers.
5. **Routes (`routes.ts`)**
    - `/editors` lists detected editors.
    - `/attempts/:id/open-editor` (in attempts module) wraps this service and emits
      `editor.open.requested/succeeded/failed` around the call.

## Key Entry Points

- `detect.ts` / `env.ts` / `open.ts`: editor detection, environment preparation, and launch logic.
- `service.ts`: stable façade re-exported to other modules.
- Integrated via attempts route for launching worktrees.

## Open Tasks

- Capture PID/metadata on successful launches (when available) and include in events.
- Add listener to surface failure events in the UI with user-friendly messaging.
- Provide tests around command resolution and environment detection.
