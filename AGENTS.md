# KanbanAI Development Guidelines

Last updated: 2025-11-23

## Active Technologies

- TypeScript (workspace), Bun runtime 1.3.x
- Monorepo orchestration: Turbo
- Server: Hono, Drizzle ORM (SQLite)
- Client: React + Vite

## Monorepo Structure

```
client/   # React + Vite app (UI)
server/   # Hono API + app factory (createApp)
shared/   # Shared types/interfaces
core/     # Core logic + tests/coverage gates
cli/      # npx launcher + packaged single binaries
```

## Commands

- Dev all: `bun run dev`
- Dev (server): `bun run dev:server` (runs `server/src/dev.ts`)
- Start server (no Turbo): `bun run start:server`
- Build all: `bun run build`
- Build client/server: `bun run build:client` / `bun run build:server`
- Build standalone binaries + release bundles: `bun run build:binary` (all targets) or `bun run build:binary:<target>` for a specific platform (`linux-x64`, `linux-arm64`, `darwin-arm64`, `win-x64`).

## Contribution Boundaries

- Server workspace remains API-only for development; `client/` continues to own UI hosting. Static serving is limited to the dedicated standalone entrypoint used by the CLI bundles.
- `server/` exports `createApp` and helpers; no `import.meta.main` side-effects outside purpose-built bins (currently `server/src/bin/standalone.ts`).
- Client stays a standalone Vite app; host separately.

## CI Packaging

- `scripts/build-binaries.ts` runs `bun build --compile` with embedded `client/dist` + `server/drizzle` assets, emitting per-platform binaries at `cli/dist/kanban-ai-<platform>`.
- `.github/workflows/release-cli.yml` builds all targets, uploads the raw binaries as GitHub Release assets, and publishes the `cli/` workspace to npm (`npx kanban-ai`).
- The CLI launcher (`cli/bin/kanban-ai.js`) downloads/caches the platform binary directly (no zip or static-dir staging), auto-checks for the latest release on every run, and defaults to using it; overrides remain supported via `KANBANAI_*` env vars if needed. Defaults point `KANBANAI_STATIC_DIR`/`KANBANAI_MIGRATIONS_DIR` to the embedded bundle (`__embedded__`).

## Recent Changes

- 2025-11-23: upgraded to Bun 1.3 single-exe packaging; release artifacts are plain binaries with embedded client + drizzle assets; CLI downloads binaries directly.
- 2025-11-22: removed CLI workspace/binary packaging and server-side static client serving; UI is now served independently via Vite.

<!-- MANUAL ADDITIONS START -->
* CLI package now ships per-platform zip archives in `cli/dist/<platform>/kanban-ai-<platform>.zip`; launcher prefers these before hitting GitHub. Use `KANBANAI_OFFLINE=1` or `--offline` to skip network fetches.
<!-- MANUAL ADDITIONS END -->
