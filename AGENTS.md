# KanbanAI Development Guidelines

Last updated: 2025-10-10

## Active Technologies
- TypeScript (workspace), Bun runtime 1.2.x
- Monorepo orchestration: Turbo
- Server: Hono, Drizzle ORM (SQLite)
- Client: React + Vite
- New: CLI workspace and runner wrapper (001-wrap-our-package)

## Monorepo Structure
```
client/   # React + Vite app (UI)
server/   # Hono API + app factory (createApp)
shared/   # Shared types/interfaces
core/     # Core logic + tests/coverage gates
cli/      # CLI entry (process bootstrap) + runner wrapper
dist/     # Packaged binaries (kanbanai*, per-platform)
```

## Commands
- Dev all: `bun run dev`
- Dev (server): `bun run dev:server` (runs `server/src/dev.ts`)
- Dev (cli): `bun run dev:cli`
- Build all: `bun run build`
- Build client/server/cli: `bun run build:client` / `bun run build:server` / `bun run build:cli`
- Package binary (current host): `bun run package`
- Run via package runner: `bunx kanban-ai [--host <h>] [--port <p>] [--open|--no-open]`

## Binary Wrapper Details
- Wrapper path: `cli/bin/kanbanai.cjs`
- Resolves binaries in `dist/` using: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64.exe`, `win32-arm64.exe`, or fallback `dist/kanbanai`.
- For changes to binary naming, update both the wrapper and CI artifact names.

## Contribution Boundaries
- Process/bootstrap logic lives in `cli/` (flag parsing, Bun.serve, help/version).
- `server/` exports `createApp` and helpers; no `import.meta.main` side‑effects.
- Client route registration is in `server/src/client.ts`.

## CI Packaging
- Workflow: `.github/workflows/build-binaries.yml` builds host‑specific binaries on Ubuntu, macOS, Windows and uploads artifacts; on `v*` tags, creates a GitHub Release with all binaries.

## Recent Changes
- 001-wrap-our-package: extracted CLI bootstrap to `cli/`, added runner wrapper, updated packaging scripts, added CI matrix workflow, docs updated.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
