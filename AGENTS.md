# KanbanAI Development Guidelines

Last updated: 2025-11-30

## Active Technologies

- TypeScript (workspace), Bun runtime 1.3.x
- Monorepo orchestration: Turbo
- Server: Hono, Drizzle ORM (SQLite)
- Client: React + Vite

## Monorepo Structure

```
cli/      # npm-distributed CLI wrapper that downloads/runs the published binary
client/   # React + Vite app (UI)
server/   # Hono API + app factory (createApp)
shared/   # Shared types/interfaces
core/     # Core logic + tests/coverage gates
```

## Commands

- Dev all: `bun run dev`
- Dev (server): `bun run dev:server` (runs `server/src/entry/dev.ts`)
- Start server (no Turbo): `bun run start:server`
- Build all: `bun run build`
- Build client/server: `bun run build:client` / `bun run build:server`
- Single-origin production server (API + static UI): `bun run prod` (builds client + server, generates the embedded static bundle, and starts the Hono server on one port).
- Build single binary server: `bun run build:binary` (emits self-contained executables for `linux-x64`, `linux-arm64`, `darwin-arm64`, and `win-x64` in `dist/kanban-ai-<platform>`; each binary serves API + static UI with embedded migrations and static assets by default, with overrides via `KANBANAI_STATIC_DIR` / `KANBANAI_MIGRATIONS_DIR`).
- CLI workspace: from `cli/`, `bun run build` compiles via `tsc`, `bun run test` runs Vitest. Releases run through `semantic-release` (`bun run release`, triggered by `.github/workflows/release.yml`), which builds binaries, publishes the npm package, updates `CHANGELOG.md`, and uploads assets to GitHub Releases. PR titles must follow Conventional Commits; `.github/workflows/semantic-pr.yml` enforces the check, and the old manual release workflows (`release-binary.yml`, `release-cli.yml`) remain as fallbacks.

## Contribution Boundaries

- Server workspace remains API-only for development; `client/` continues to own UI hosting in dev. Static serving is limited to a dedicated single-origin server entrypoint in `server/` used for production/self-host setups.
- `server/` exports `createApp` and helpers; no `import.meta.main` side-effects outside purpose-built bins/entries (e.g. `server/src/entry/dev.ts`, `server/src/entry/prod.ts`).
- Client stays a standalone Vite app; in production the built assets from `client/dist` are served by the single-origin Hono server (embedded into the binary by default, with filesystem overrides via `KANBANAI_STATIC_DIR`).
- The `cli/` wrapper simply discovers/releases binaries before spawning them; keep it dependency-light, avoid process-wide side effects outside `src/index.ts`, and rely on GitHub Releases (plus the workflow above) for distribution rather than bundling server code directly.

## Deployment Notes

- For development, always use split dev servers: `bun run dev` (Turbo orchestrated Vite + API).
- For single-origin self-hosting, use the dedicated `prod` entrypoint (see the Mintlify docs in `docs/index.mdx` for details on running `bun run prod` + the bundled static assets).
- For releases, trust the semantic-release workflow above; existing manual jobs (`release-binary.yml`, `release-cli.yml`) remain available as fallbacks.
