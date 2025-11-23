# kanban-ai CLI

`npx kanban-ai` downloads the platform-specific KanbanAI single binary (API + UI + embedded migrations) from GitHub
Releases, caches it at `~/.kanbanAI/<version>/<platform>`, and starts the server on one port (default `3000`).

```bash
npx kanban-ai -- --port 4000
```

When run via `npx`/`bunx`, the launcher always checks npm + GitHub for the newest binary. Interactive shells are prompted
(default Yes) to download and run the latest; non-interactive shells auto-use the latest binary.

## Options

- `--binary-version <version>`: download and run a specific release instead of matching the CLI package version.
- `--port`, `PORT`: override listen port (default: 3000)
- `--host`, `HOST`: override listen address (default: 0.0.0.0)
- `KANBANAI_STATIC_DIR`: optional override for the embedded client assets (defaults to `__embedded__`)
- `KANBANAI_MIGRATIONS_DIR`: optional override for the embedded drizzle migrations (defaults to `__embedded__`)
- `KANBANAI_BINARY_BASE_URL`: override the GitHub Releases base URL for testing
- `KANBANAI_CACHE_DIR`: override cache location (default: `~/.kanbanAI`)
- `KANBANAI_DEBUG=1`: verbose logs from the launcher

## Codex binary resolution

The launcher ensures the Codex CLI is present before starting the server:

1) Use `CODEX_PATH_OVERRIDE` or `CODEX_PATH` if set.
2) Otherwise look for `codex` (`codex.exe` on Windows) on `PATH`.
3) If still missing, download the latest `@openai/codex-sdk` tarball from npm, extract the platform-specific `codex`
   binary, and cache it at `~/.kanbanAI/codex/<version>/<vendor>/codex`.

Tunable env vars:

- `KANBANAI_CODEX_VERSION`: override the Codex SDK version to download (default: latest published).
- `KANBANAI_CODEX_TARBALL_URL`: override the tarball URL (defaults to npm registry).
- `KANBANAI_CACHE_DIR`: shared cache root (affects both app bundle and Codex cache).

Release assets are named `kanban-ai-<platform>` (e.g., `kanban-ai-linux-x64`, `kanban-ai-win-x64.exe`).
