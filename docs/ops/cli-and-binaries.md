# CLI & Binary Distribution

Last updated: 2025-11-30

## CLI wrapper (`kanban-ai` on npm)

- The `cli/` workspace publishes a thin Node-based wrapper installed as `kanban-ai`.
- The wrapper:
  - Detects your platform/architecture.
  - Resolves which KanbanAI binary version to run (using cached binaries and GitHub Releases).
  - Downloads the binary if needed and caches it under:
    - `$KANBANAI_HOME/.kanbanAI/binary`
    - or `~/.kanbanAI/binary` by default.
  - Spawns the resolved binary with any pass-through flags.
- Typical usage:
  - `npx kanban-ai -- --help`
  - `npx kanban-ai --binary-version 0.4.0`

### CLI flags

- `--binary-version <semver>` – pick a specific KanbanAI release.
- `--no-update-check` – skip GitHub lookups and reuse the newest cached binary.
- `--cli-version` – print the wrapper version (from `cli/package.json`) and exit.
- `--version` / `--help` – standard inspection flags; do not launch the server.
- Any arguments after `--` are passed directly through to the KanbanAI binary.

### Environment variables

- `KANBANAI_BINARY_VERSION` – equivalent to `--binary-version`.
- `KANBANAI_HOME` – overrides the base cache directory (defaults to `$HOME` from the OS).
- `KANBANAI_GITHUB_REPO` – overrides the GitHub repo used for releases (defaults to `activadee/kanban-ai`).
- `KANBANAI_NO_UPDATE_CHECK` – equivalent to `--no-update-check`.
- `KANBANAI_ASSUME_YES` / `KANBANAI_ASSUME_NO` – automate update prompts for non-interactive usage.
- For higher GitHub rate limits, the wrapper also respects:
  - `GITHUB_TOKEN` / `GH_TOKEN` – used when contacting the GitHub Releases API.

## Production server entrypoint

- The production server entrypoint lives at `server/src/entry/prod.ts`.
- At the root, `bun run prod`:
  - Runs the `build:prod` pipeline:
    - Runs `scripts/build-prisma-migration-bundle.ts` to generate the bundled Prisma migration data consumed at runtime.
    - Builds the client (`client/dist`) and server.
    - Copies `client/dist` into `server/static`.
    - Generates an embedded static bundle.
  - Starts the compiled production server, which:
    - Serves the API under `/api/v1` (with a compatibility shim at `/api`).
    - Serves the built React app and static assets from the embedded bundle.
- The prod entry supports flags when run directly:
  - `bun run server/src/entry/prod.ts --help` – print usage.
  - `--host <host>` – override `HOST` (default `127.0.0.1`).
  - `--port <port>` – override `PORT` (default `3000`).
  - `--migrations-dir <path>` – override `KANBANAI_MIGRATIONS_DIR`.

### Environment configuration

- Server configuration is derived from environment variables with sensible defaults:
  - `HOST` – interface to bind (defaults to `127.0.0.1`).
  - `PORT` – port to listen on (defaults to `3000`).
  - `DATABASE_URL` – SQLite database path (e.g., `sqlite:/absolute/path/to/kanban.db`); defaults to an OS data directory such as `~/.local/share/kanbanai/kanban.db`.
  - `KANBANAI_MIGRATIONS_DIR` – directory containing Prisma migrations (`server/prisma/migrations` format); used when not relying solely on the embedded bundle.
  - `KANBANAI_STATIC_DIR` – optional override for static assets (useful for custom branding or external `client/dist`).
  - `LOG_LEVEL` – `debug` | `info` | `warn` | `error` (default `info`).
  - `KANBANAI_DEBUG` / `DEBUG` – enable additional per-request traces when set to truthy values or appropriate namespaces.
- Example:

```bash
LOG_LEVEL=debug KANBANAI_DEBUG=1 bun run prod
```

## Binary builds

- Self-contained binaries are produced via:
  - `bun run build:binary`
- This pipeline:
  - Runs the production build (`build:prod`).
  - Uses `bun build --compile` to emit executables for common platforms:
    - `dist/kanban-ai-linux-x64`
    - `dist/kanban-ai-linux-arm64`
    - `dist/kanban-ai-darwin-arm64`
    - `dist/kanban-ai-win-x64.exe`
- Each binary:
  - Embeds the Prisma migration bundle (the generated `server/prisma/migration-data.generated.ts`) and static assets by default.
  - Serves the API and React UI on a single origin (respecting `HOST`, `PORT`, `DATABASE_URL`, `KANBANAI_MIGRATIONS_DIR`, and `KANBANAI_STATIC_DIR`).
- In most self-hosted setups:
  - The CLI wrapper downloads and runs the appropriate binary.
  - You configure environment variables exactly as you would for `bun run prod`.

## Release automation

- Semantic-release runs on `main` via `.github/workflows/release.yml`, which is now triggered manually (`workflow_dispatch`) rather than by push events; use the GitHub Actions tab or `gh workflow run release.yml` to start it.
- The job still versions, tags, publishes the CLI to npm, and creates GitHub Releases with binaries attached.
- PR titles must follow Conventional Commits; `.github/workflows/semantic-pr.yml` enforces this check (require it in branch protection for effect).
- Release steps: analyze commits → bump versions (`package.json`, `cli/package.json`) → update `CHANGELOG.md` → build binaries with `bun run build:binary` → publish npm from `cli/` → upload `dist/kanban-ai-*` to the GitHub release.
- npm publish uses npm Trusted Publishing (OIDC) — no long-lived `NPM_TOKEN` required; workflow has `id-token: write` and runs with `NPM_CONFIG_PROVENANCE=true`.
- Existing manual jobs (`release-binary.yml`, `release-cli.yml`) remain as fallbacks.
