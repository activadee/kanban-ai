# Memory Log

## 2025-10-10 — Feature 001: Wrap package for runner and extract CLI entry

- Branch: `001-wrap-our-package`
- Spec: `specs/001-wrap-our-package/spec.md`
- Plan: `specs/001-wrap-our-package/plan.md`
- Tasks: `specs/001-wrap-our-package/tasks.md`
- Summary: Extracted CLI bootstrap from `server/src/app.ts` into new `cli/` workspace (`cli/src/main.ts`). Implemented runner wrapper (`cli/bin/kanbanai.cjs`) that resolves platform‑specific binaries under `dist/`, forwards args/stdio/signals, and returns child exit codes. Updated packaging scripts to compile from `cli/src/main.ts`. Added CI matrix workflow to build binaries on Linux/macOS/Windows and upload artifacts; tagged releases publish assets.
- Key decisions: Keep `server/` as app factory (`createApp`) with no `import.meta.main` side‑effects; register client routes via `server/src/client.ts`; runtime helpers in `server/src/runtime.ts`.
- Commands:
  - Build current platform: `bun run package`
  - Run via runner: `bunx kanban-ai [--port <n>] [--open]`
- Docs updated: `README.md` (runner usage), `AGENTS.md` (structure/commands/CI), `constitution.md` (v1.1.0; packaging & boundaries)
- Success criteria aligned: default invocation starts on 127.0.0.1:3000 and prints URL; arguments and exit codes pass through; helpful errors on missing binary/unsupported platform.

