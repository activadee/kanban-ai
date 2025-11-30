---
title: Data & storage
---

# Data & storage

KanbanAI stores state in a local SQLite database and a set of Git worktrees under your home directory. This page
summarizes where data lives and how it is managed.

## Database

- Engine:
  - SQLite via `bun:sqlite`, managed by Drizzle.
- Location:
  - Production (`bun run prod`, compiled binaries): defaults to `kanban.db` under the OS-specific data directory (e.g.
    `~/.local/share/kanbanai/kanban.db` on Linux).
  - Development (`bun run dev`): defaults to `kanban-dev.db` in the same data directory, so local experiments never
    touch the production-style database file.
  - Overrides:
    - `DATABASE_URL` – highest precedence everywhere (dev and prod).
    - `KANBANAI_DEV_DATABASE_URL` – dev-only override used when `DATABASE_URL` is unset; accepts the same formats as
      `DATABASE_URL`.
- Migrations:
  - Drizzle migrations are embedded into the server/binary.
  - On server start, migrations are applied automatically before handling requests.
  - You can override the migrations directory with `KANBANAI_MIGRATIONS_DIR` when using external migration files.

## Worktrees

- Purpose:
  - Attempts run inside dedicated Git worktrees so changes stay isolated from your main repository.
- Location:
  - Under `$HOME/.kanbanAI/worktrees/<project>/<attempt>/...`.
  - Paths are derived from project/board IDs and attempt IDs.
- Lifecycle:
  - Created when an Attempt starts or is resumed and needs a workspace.
  - Cleaned up when:
    - A card is moved to **Done** and its Attempt is finished (Tasks cleanup listener).
    - A project is deleted (Filesystem listener purges worktrees for that repo).

## Static assets

- In development:
  - The server is API-only; the React app is served by the Vite dev server.
- In production / binaries:
  - The built client (`client/dist`) is copied into `server/static` and bundled into the binary.
  - The prod entry serves the React app and assets from the embedded static bundle.
  - You can override the static directory with `KANBANAI_STATIC_DIR` to:
    - Serve a custom `client/dist`.
    - Apply custom branding or external hosting.

## Configuration summary

Key environment variables related to data & storage:

- `DATABASE_URL` – SQLite database location (defaults to OS data dir).
- `KANBANAI_DEV_DATABASE_URL` – dev-only database location override; used only by `bun run dev` when `DATABASE_URL` is
  unset.
- `KANBANAI_MIGRATIONS_DIR` – external migrations directory (optional).
- `KANBANAI_STATIC_DIR` – external static assets directory (optional).
- `KANBANAI_HOME` – base directory for binaries/CLI cache (used by the CLI wrapper; defaults to `$HOME`).

For runtime configuration (host, port, log level, etc.), see `ops/cli-and-binaries.md`.
