# KanbanAI Development Guidelines

Last updated: 2025-10-10

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
```

## Commands

- Dev all: `bun run dev`
- Dev (server): `bun run dev:server` (runs `server/src/dev.ts`)
- Start server (no Turbo): `bun run start:server`
- Build all: `bun run build`
- Build client/server: `bun run build:client` / `bun run build:server`

## Contribution Boundaries

- Server stays API-only; do not reintroduce embedded/static client serving.
- `server/` exports `createApp` and helpers; no `import.meta.main` side‑effects.
- Client stays a standalone Vite app; host separately.

## CI Packaging

- Binary packaging is removed; no CLI artifacts are built in CI.

## Recent Changes

- 2025-11-22: removed CLI workspace/binary packaging and server-side static client serving; UI is now served independently via Vite.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
