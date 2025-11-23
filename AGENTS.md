# KanbanAI Development Guidelines

Last updated: 2025-12-01

## Active Technologies

- TypeScript (workspace), Bun runtime 1.2.x
- Monorepo orchestration: Turbo
- Server: Hono, Drizzle ORM (SQLite)
- Client: React + Vite

## Monorepo Structure

```
client/   # React + Vite app (UI)
server/   # Hono API + app factory (createApp)
shared/   # Shared types/interfaces
core/     # Core logic + tests/coverage gates
cli/      # npx launcher + packaged binaries/assets
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

- `scripts/build-binaries.ts` compiles the standalone binary via Bun, stages `client-dist` + `drizzle` assets, and zips release payloads into `cli/dist/kanban-ai-<platform>.zip`.
- `.github/workflows/release-cli.yml` runs on tags (`v*`) to build all targets, upload the zipped bundles as GitHub Release assets, and publish the `cli/` workspace to npm (`npx kanban-ai`).
- The CLI launcher (`cli/bin/kanban-ai.js`) downloads/caches the matching zip, sets `KANBANAI_STATIC_DIR`/`KANBANAI_MIGRATIONS_DIR`, and starts the bundled binary.

## Recent Changes

- 2025-11-22: removed CLI workspace/binary packaging and server-side static client serving; UI is now served independently via Vite.
- 2025-12-01: reintroduced a CLI workspace with `npx kanban-ai`, added a standalone binary entrypoint that serves bundled UI assets, and automated release packaging via `release-cli` workflow.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
