# Editor Module

## Purpose

- Detect available editors, build launch commands, and open worktree paths for attempts.
- Validate editor executables to ensure they are accessible and executable.
- Emit editor open events so the UI can reflect success or failure.

## Data & Event Flow

1. **Detection (`detect.ts`)**
    - `detectEditors` inspects registered adapters and reports installed editors.
    - `getAdapterForKey` resolves a concrete adapter from an editor key with sensible fallback.
    - Returns editor suggestions with key, label, and binary path for UI selection.
2. **Validation (`validate.ts`)**
    - `validateEditorExecutable` checks if a given executable path exists and is executable.
    - Provides detailed error messages for invalid configurations.
3. **Environment (`env.ts`)**
    - `createDesktopEnv` derives a baseline GUI-friendly environment (PATH, DISPLAY, XDG runtime, DBUS).
    - `loadUserSessionEnv` and `applySessionEnv` merge in session environment (e.g. systemd user env on Linux).
    - `buildEditorEnv` produces the final environment for a specific editor key.
4. **Open (`open.ts`)**
    - `openEditorAtPath` resolves the preferred editor from settings, builds the command, and spawns it detached with
      a fallback shell command when needed.
    - Supports custom editor commands specified via settings.
5. **Service façade (`service.ts`)**
    - Re-exports `detectEditors`, `openEditorAtPath`, and related helpers for external callers.
6. **Routes (`routes.ts`)**
    - `GET /editors/suggestions` lists detected installed editors.
    - `POST /editors/validate` validates an editor executable path.
    - `POST /editors/open` opens a path in a configured editor.
    - `/attempts/:id/open-editor` (in attempts module) wraps this service and emits
      `editor.open.requested/succeeded/failed` around the call.

## Supported Editors

The following editor adapters are supported:
- VS Code
- Cursor
- IntelliJ IDEA
- WebStorm
- Neovim
- Vim

The Antigravity adapter has been removed.

## Key Entry Points

- `detect.ts` / `validate.ts` / `env.ts` / `open.ts`: editor detection, validation, environment preparation, and launch logic.
- `service.ts`: stable façade re-exported to other modules.
- Integrated via attempts route for launching worktrees.
- File browser integration allows users to browse for editor executables via the filesystem module.

## Open Tasks

- Capture PID/metadata on successful launches (when available) and include in events.
- Add listener to surface failure events in the UI with user-friendly messaging.
- Provide tests around command resolution and environment detection.
---
title: Server: Editor module
---
