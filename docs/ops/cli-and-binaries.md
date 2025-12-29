# CLI & Binary Distribution

Last updated: 2025-11-30

## CLI wrapper (`kanban-ai` on npm)

- The `cli/` workspace publishes a thin Node-based wrapper installed as `kanban-ai`.
- The wrapper:
  - Detects your platform/architecture.
  - Resolves which KanbanAI binary version to run (using cached binaries and GitHub Releases).
  - Downloads the binary if needed and caches it under:
    - `$XDG_CACHE_HOME/kanban-ai/binary`
    - or `~/.cache/kanban-ai/binary` by default.
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
- `KANBANAI_HOME` – overrides the base home directory (defaults to `$HOME` from the OS).
- `KANBANAI_GITHUB_REPO` – overrides the GitHub repo used for releases (defaults to `activadee/kanban-ai`).
- `KANBANAI_NO_UPDATE_CHECK` – equivalent to `--no-update-check`.
- `KANBANAI_ASSUME_YES` / `KANBANAI_ASSUME_NO` – automate update prompts for non-interactive usage.
- `XDG_CONFIG_HOME` – overrides the config directory (default: `~/.config/kanban-ai`).
- `XDG_CACHE_HOME` – overrides the cache directory (default: `~/.cache/kanban-ai`).
- For higher GitHub rate limits, the wrapper also respects:
  - `GITHUB_TOKEN` / `GH_TOKEN` – used when contacting the GitHub Releases API.

### GitHub release lookups

- Release metadata fetched from the GitHub API is now cached on disk under `github-api` in the config directory (e.g.
  `~/.config/kanban-ai/github-api` when using the defaults). Cached entries use ETags/`If-None-Match` headers, respect a 30‑minute TTL,
  and are refreshed transparently when the release data changes.
- When the API returns `304 Not Modified` or requests are made within the TTL, the CLI reads the stored JSON instead of counting
  against your rate limit.
- If a rate-limit error (`403`/`429`) occurs, the CLI logs a warning (the same message suggests providing `GITHUB_TOKEN`/`GH_TOKEN`
  for higher limits), keeps using the cached metadata if available, and continues the flow. Without cached data, it falls back to
  resolving the release download URL through GitHub's `releases/download` redirect, which still succeeds even when the
  API is temporarily blocked.
- The same redirect-based fallback happens when a pinned release lookup (`--binary-version`) hits the rate limit: the CLI
  follows the download redirect for the requested version and proceeds with that asset to avoid an unnecessary failure.

### Directory structure

The CLI follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html):

- **Config**: `$XDG_CONFIG_HOME/kanban-ai` (default: `~/.config/kanban-ai`)
- **Cache**: `$XDG_CACHE_HOME/kanban-ai` (default: `~/.cache/kanban-ai`)
- **Binary cache**: `$XDG_CACHE_HOME/kanban-ai/binary`
- **GitHub API cache**: `$XDG_CONFIG_HOME/kanban-ai/github-api`

On Windows, the CLI uses `APPDATA` for config and `LOCALAPPDATA` for cache as conventional locations.

### Migration from legacy directory

If you previously used KanbanAI with the legacy `.kanbanAI` directory (`~/.kanbanAI`), the CLI includes migration utilities to move your data to the new XDG-compliant locations.

The migration:
- Detects the legacy directory automatically.
- Copies `github-api` to the new config location.
- Copies `binary` and other cache items to the new cache location.
- Does not delete the legacy directory (manual cleanup is required).

To run migration manually or check status, use the CLI's migration commands (when available) or run with environment variables to verify paths.

## Production server entrypoint

- The production server entrypoint lives at `server/src/entry/prod.ts`.
- At the root, `bun run prod`:
  - Runs the `build:prod` pipeline:
    - Runs `scripts/build-drizzle-migration-bundle.ts` to generate the bundled Drizzle migration data consumed at runtime.
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
  - `KANBANAI_MIGRATIONS_DIR` – directory containing Drizzle migrations (a folder of ordered `.sql` files, e.g. a copy of `server/drizzle`); used when not relying solely on the embedded bundle.
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
  - Embeds the Drizzle migration bundle (the generated `server/drizzle/migration-data.generated.ts`) and static assets by default.
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
