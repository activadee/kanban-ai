---
title: Security & privacy
---

# Security & privacy

KanbanAI is primarily designed for local and self-hosted use. This page summarizes how data and credentials are handled,
what leaves your machine, and considerations when running KanbanAI for a team.

## Data locality

- **Application database**
  - Stored in a local SQLite file (see [Data & storage](core/data-and-storage) for paths and configuration).
  - Contains:
    - Projects, boards, and cards.
    - Attempts, logs, and conversation history.
    - Global and per-project settings.
    - Onboarding state and GitHub OAuth app configuration.
  - No remote database is contacted by default.

- **Worktrees**
  - Attempt worktrees live under `$HOME/.kanbanAI/worktrees/<project>/<attempt>/...`.
  - They contain:
    - Cloned repositories for projects.
    - All file changes made by the agent or by you during an Attempt.

- **Static assets**
  - In production, the React app and static assets are either:
    - Embedded into the binary, or
    - Served from a local directory you control via `KANBANAI_STATIC_DIR`.

Outside of GitHub and model-backend calls, KanbanAI does not send project/board/attempt data to third-party services.

## Credentials & secrets

- **GitHub OAuth App**
  - Client ID and secret:
    - Can be provided during onboarding, via Settings → GitHub, or via `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
    - When entered in the UI, they are stored in the local SQLite database (`github_app_configs`).
  - Access tokens:
    - Obtained via GitHub Device Flow and stored locally.
    - Used only for GitHub API calls (auth checks, repo/issue/PR access) from the server.

- **Model / Codex API keys**
  - Provided via environment variables (e.g. `CODEX_API_KEY`, optional `OPENAI_BASE_URL`).
  - Read by the server process to call the configured model backend.
  - Not stored in the application database.

- **CLI wrapper tokens**
  - The `kanban-ai` npm CLI wrapper can use:
    - `GITHUB_TOKEN` / `GH_TOKEN` to query GitHub Releases and download binaries.
  - These tokens are read from the environment and never persisted by KanbanAI itself.

## Outbound network traffic

By default, the server and CLI make outbound calls to:

- **GitHub**:
  - Device Flow endpoints during OAuth.
  - REST APIs for:
    - User info and repo discovery.
    - Issue import (when you use “Import GitHub issues”) and issue export/update (when the Create GitHub Issue checkbox creates or keeps a GitHub issue in sync with a card).
    - Pull request creation and inspection.
  - Release APIs when the CLI checks for or downloads a new binary.

- **Model backend (e.g. Codex/OpenAI-compatible)**:
  - Attempts send prompts, code snippets, and diff summaries to the configured model endpoint.
  - The exact endpoint is controlled by your environment configuration.

KanbanAI itself does not implement any telemetry or analytics. If you introduce telemetry, document it clearly and keep it
opt-in.

## Multi-user considerations

KanbanAI is currently optimized for:

- Single-user or small-team deployments where:
  - The server runs under a single OS user account.
  - That account owns:
    - The database and worktree directories.
    - GitHub OAuth credentials and model API keys.

In multi-user scenarios:

- All users share:
  - The same GitHub connection.
  - The same model backend credentials.
  - The same SQLite database and worktree root.
- There is no built-in RBAC or per-user permission model.

If you deploy KanbanAI for multiple users:

- Treat the host as a trusted development machine.
- Control access at the OS, network, or reverse-proxy layer (e.g. HTTP auth, VPN).

## Hardening tips

- **Bind to localhost by default**
  - `HOST` defaults to `127.0.0.1`.
  - When exposing KanbanAI publicly, put it behind a TLS-terminating reverse proxy.

- **Protect local data**
  - Restrict access to:
    - The SQLite DB file (`DATABASE_URL` path).
    - The `~/.kanbanAI` directory (worktrees and CLI cache).
    - Environment files such as `server/.env`.

- **Logging**
  - Use `LOG_LEVEL=info` or `warn` in production.
  - Avoid logging secrets or full HTTP payloads.
  - Enable `LOG_LEVEL=debug` or `KANBANAI_DEBUG` only when needed and in controlled environments.
  - Enable `LOG_LEVEL=debug` or `KANBANAI_DEBUG` only when needed and in controlled environments.

For deployment patterns (binaries, process managers, reverse proxies), see [Deployment patterns](ops/deployment). For
storage details, see [Data & storage](core/data-and-storage).
