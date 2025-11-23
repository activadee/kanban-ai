# kanban-ai CLI

`npx kanban-ai` downloads the platform-specific KanbanAI single binary (API + UI) from GitHub Releases, extracts it to
`~/.kanban-ai/<version>/<platform>`, and starts the server on one port (default `3000`).

```bash
npx kanban-ai -- --port 4000
```

## Options

- `--port`, `PORT`: override listen port (default: 3000)
- `--host`, `HOST`: override listen address (default: 0.0.0.0)
- `KANBANAI_STATIC_DIR`: path to `client-dist` (auto-set by the CLI)
- `KANBANAI_MIGRATIONS_DIR`: path to `drizzle` migrations (auto-set by the CLI)
- `KANBANAI_BINARY_BASE_URL`: override the GitHub Releases base URL for testing
- `KANBANAI_CACHE_DIR`: override cache location (default: `~/.kanban-ai`)
- `KANBANAI_DEBUG=1`: verbose logs from the launcher

On first run the CLI downloads a zip named `kanban-ai-<platform>.zip` from the release tag matching the CLI version
(e.g., `v0.4.0`). Subsequent runs reuse the extracted cache unless you delete it or set a different version.
