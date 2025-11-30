---
title: Troubleshooting & FAQ
---

# Troubleshooting & FAQ

Common issues and how to debug them when running KanbanAI locally or in self-hosted environments.

## Codex CLI / agent fails

**Symptom:** Attempts fail immediately, or the Dashboard shows no agents registered.

- Ensure the Codex CLI is installed and on `PATH`.
- Verify `CODEX_API_KEY` is set in `server/.env` (or equivalent env for your process).
- Optional overrides:
  - `OPENAI_BASE_URL` – override the default API base.
  - `CODEX_PATH` / `CODEX_PATH_OVERRIDE` – point KanbanAI at a non-default Codex binary path.
- Check server logs (see Logging section below) for errors from the agents module.

## GitHub OAuth / device flow issues

**Symptom:** Device flow never completes, or GitHub connection status stays “Not connected”.

- Verify your GitHub OAuth App:
  - Device Flow is enabled.
  - Client ID/secret are copied correctly.
- Check how credentials are provided:
  - During onboarding or via Settings → GitHub OAuth App.
  - Or via `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `server/.env`.
- Use the onboarding guide:
  - See `docs/guides/onboarding.md` for the exact API flow.
- Check `/api/v1/auth/github/check` to see the current auth status.

## Database & migrations

**Symptom:** Server fails to start with migration or database errors.

- Confirm `DATABASE_URL`:
  - If unset, the server will use the default OS data directory path.
  - If set, ensure the directory exists and the process has write permission.
- Check migrations:
  - Migrations run automatically on start.
  - If you override `KANBANAI_MIGRATIONS_DIR`, ensure it points at a valid Drizzle migrations directory.
- Look at logs around startup for `migrations` or `db` errors.

## Worktrees & disk usage

**Symptom:** Disk fills up, or stale worktrees remain after heavy use.

- Worktree location:
  - `$HOME/.kanbanAI/worktrees/<project>/<attempt>/...`.
- Automatic cleanup:
  - When cards move to **Done** and Attempts are finished, Tasks listeners call cleanup.
  - Project deletion also purges worktrees for that repo.
- Manual cleanup:
  - Stop the server.
  - Inspect/remove stale worktree directories under `~/.kanbanAI/worktrees` as needed.

## Logging & debugging

- Logs are human-readable lines emitted via Winston:
  - Format: `LEVEL [scope] message key=value ...`.
  - Scopes align with domains (e.g. `[github:repos]`, `[tasks]`, `[ws:kanban]`, `server`).
  - `LOG_LEVEL` controls verbosity (`debug`, `info`, `warn`, `error`; default `info`).
- Request-level traces:
  - Enabled with `KANBANAI_DEBUG=1`, `DEBUG=*` / `DEBUG=kanbanai*`, or `LOG_LEVEL=debug`.
  - When on, Hono logs appear at `debug` level with the `hono` scope alongside regular server logs.
- Examples:

```bash
DEBUG=kanbanai* LOG_LEVEL=debug bun run prod   # debug logs + Hono request lines (scope=hono)
```

## Ports & host conflicts

**Symptom:** Server fails to bind or UI can’t reach the API.

- Defaults:
  - API host: `127.0.0.1`
  - API port: `3000`
- Overrides:
  - `HOST` and `PORT` env vars.
- Ensure nothing else is running on the chosen port and that your client `.env` (`VITE_SERVER_URL`) matches.
