---
title: Deployment patterns
---

# Deployment patterns

This page outlines common ways to run KanbanAI beyond local development: single-origin Bun server, compiled binaries,
and running behind a reverse proxy or process manager.

## Single-origin Bun server

For small self-hosted setups, you can run the Bun-based server directly:

1. Build and start:

   ```bash
   bun install
   bun run prod
   ```

   This will:

   - Build the client and server.
   - Copy `client/dist` into `server/static`.
   - Generate an embedded static bundle.
   - Start a single Hono/Bun server that serves:
     - API under `/api/v1` (shim at `/api`).
     - The React app and static assets with SPA fallback.

2. Configure environment:

   - `HOST` / `PORT` – listening interface and port (default `127.0.0.1:3000`).
   - `DATABASE_URL` – SQLite file path.
   - `KANBANAI_MIGRATIONS_DIR` – optional external migrations directory.
   - `KANBANAI_STATIC_DIR` – optional external `client/dist` directory.
   - `LOG_LEVEL`, `KANBANAI_DEBUG`, `DEBUG` – logging behavior.

## Compiled binaries + CLI wrapper

If you prefer a single executable:

1. Build binaries (for development or custom deployment):

   ```bash
   bun run build:binary
   ```

   This emits:

   - `dist/kanban-ai-linux-x64`
   - `dist/kanban-ai-linux-arm64`
   - `dist/kanban-ai-darwin-arm64`
   - `dist/kanban-ai-win-x64.exe`

2. Use the npm CLI wrapper in production:

   ```bash
   npx kanban-ai -- --help
   npx kanban-ai -- --port 3000
   ```

   The wrapper:

   - Resolves the correct binary for your platform (downloading if needed).
   - Caches binaries under `~/.kanbanAI/binary` (or `KANBANAI_HOME`).
   - Passes any arguments after `--` through to the binary.

3. Configure environment:

   - Use the same env vars as `bun run prod` (HOST, PORT, DATABASE_URL, etc.).

## Process managers (systemd, supervisord, pm2)

For long-running services, wrap the binary or Bun command in a process manager. Example `systemd` service:

```ini
[Unit]
Description=KanbanAI
After=network.target

[Service]
Type=simple
User=kanban
WorkingDirectory=/opt/kanban-ai
Environment=PORT=3000
Environment=HOST=127.0.0.1
ExecStart=/opt/kanban-ai/dist/kanban-ai-linux-x64
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Adjust paths and environment variables to your environment.

## Reverse proxy (TLS & domains)

When exposing KanbanAI on the internet:

- Run the server/binary on an internal port (e.g. `127.0.0.1:3000`).
- Put a reverse proxy in front (Nginx, Caddy, Traefik, etc.) to:
  - Terminate TLS.
  - Handle custom domains and HTTP/2.
  - Optionally enforce HTTP auth or IP allowlists.
- Ensure WebSocket upgrade is forwarded for:
  - `/api/v1/ws`
  - `/api/v1/ws/dashboard`

## Backups

- Include in your backup strategy:
  - The SQLite database file (`DATABASE_URL` path).
  - Project Git repositories (managed separately from KanbanAI).
  - Optionally `~/.kanbanAI` if you want to preserve cached binaries and worktrees.

For CLI specifics and environment options, see [CLI & binaries](ops/cli-and-binaries). For data layout, see
[Data & storage](core/data-and-storage).

