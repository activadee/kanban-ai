# KanbanAI

Developer‑centric Kanban that turns tasks into Pull Requests with help from your favorite coding agent. Built with Bun +
Hono + React + Vite in a type‑safe monorepo, with shared models and a realtime board.

Built on the bhvr monorepo template.

## Highlights

- Kanban board with Backlog / In Progress / Review / Done
- GitHub device‑flow login, import issues as tasks, and create PRs from the app
- Per‑task Attempts run inside isolated git worktrees under `$HOME/.kanbanAI/worktrees/...`
- Diff viewer, commit (auto-stages all changes), push, Create PR, and optional auto‑merge to base
- Agent profiles (e.g., Codex via SDK) with customizable model/sandbox settings
- Full‑stack TypeScript, shared types, and Turbo for orchestration

## Monorepo Layout

```
.
├── client/   # React + Vite app (UI)
├── server/   # Hono API + agents + Git/GitHub integrations
├── shared/   # Shared TypeScript types and agent interfaces
├── docs/     # Design notes and references
└── prd.mdx   # Product requirements & changelog
```

## Prerequisites

- Git 2.40+
- Bun 1.3.3+ (repo is configured for `bun@1.3.3`)

## Quick Start (Local Dev)

1) Install dependencies

```bash
bun install
```

2) Configure environment (or plan to enter credentials during onboarding)

- Server (`server/.env`):

```env
# Optional if you plan to store credentials via onboarding/settings
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
# Optional but recommended for higher limits
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

# Optional: SQLite path (defaults to OS data dir, e.g., ~/.local/share/kanbanai/kanban.db)
DATABASE_URL=sqlite:/absolute/path/to/kanban.db

# Codex SDK
CODEX_API_KEY=your_codex_or_openai_api_key
# Optional: override base URL or codex binary path
# OPENAI_BASE_URL=https://api.openai.com/v1
# CODEX_PATH_OVERRIDE=/custom/path/to/codex
```

- Client (`client/.env`, optional unless you need a custom API origin):

```env
# Optional: override the API base (dev defaults to http://localhost:3000/api/v1)
VITE_SERVER_URL=http://localhost:3000/api/v1
```

3) Start everything (Turbo will run client and server)

```bash
bun run dev
```

- UI: <http://localhost:5173>
- API (base): <http://localhost:3000/api/v1> (shim also at `/api`)

On first launch you will be redirected to `/onboarding` to confirm preferences, Git defaults, GitHub templates, GitHub OAuth
credentials, and the GitHub device-flow connection. Completing onboarding unlocks the main workspace; you can revisit it
any time via `/onboarding`.

Note: the API server for development remains API-only. Run the Vite dev server for UI during development (`bun run dev:client`). For single-origin self-hosting, use the dedicated production server entrypoint (see Deployment).

## Initial Onboarding

The first authenticated user session is gated behind a guided onboarding flow located at `/onboarding`. The wizard:

- Collects general preferences (theme, language, telemetry, notifications) and editor/Git defaults.
- Captures GitHub branch/PR templates and the OAuth App client ID/secret, storing them in the local database.
- Walks you through the GitHub Device Authorization Flow so the sidebar immediately shows a connected account.

Onboarding auto-saves step progress and resumes where you left off after refreshes. You can re-run it later for another
team member by visiting `/onboarding`, but completion status prevents accidental regression once the final step is
submitted.

## GitHub OAuth (Device Flow)

KanbanAI uses GitHub’s Device Authorization Flow — no callback server is required.

1) Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps), enable “Device Flow”, and copy the Client
   ID (and Secret).
2) Provide the Client ID/secret either (a) during onboarding, (b) from Settings → App → GitHub OAuth App, or (c) via
   `server/.env`. Environment variables still work as a fallback if you prefer to manage secrets outside the app.
3) In the app, open onboarding or Settings → GitHub to start the device flow. You’ll be shown a user code and
   verification URL to confirm in the browser.

Scopes requested: `repo`, `read:user`, `user:email`.

## Typical Flow

1) Create a Project pointing to a local git repo (or initialize one).
2) Connect GitHub and (optionally) import issues to populate the board.
3) Drag a ticket to In Progress to start an Attempt. The server creates a worktree at
   `$HOME/.kanbanAI/worktrees/<project>/<task>` and launches your selected agent.
4) Review changes: view diffs, commit (all changes are staged automatically), push, and Create PR (the PR flow will auto-push the branch if it isn't on the remote yet).
5) When merged, move to Done. We'll remove the attempt branch and worktree automatically so the repo stays tidy.

## Scripts

Root scripts (Turbo orchestrates workspaces):

```bash
# Dev all (client + server)
bun run dev

# Dev individually
bun run dev:client   # client only
bun run dev:server   # server only

# Build all / per‑workspace
bun run build
bun run build:client
bun run build:server

# Lint / Type‑check / Test
bun run lint
bun run type-check
bun run test

# Single-origin self-host (API + UI)
bun run prod
```

### Server entrypoints

The server workspace uses two explicit entrypoints under `server/src/entry`:

- `server/src/entry/dev.ts`
  - Used by `bun run dev:server` and `bun run start:server`.
  - Starts an API-only Hono server (no static UI), intended for local development alongside the Vite dev server.

- `server/src/entry/prod.ts`
  - Used by `bun run prod` and by `bun run build:binary`.
  - Starts a single-origin server that:
    - Serves the API under `/api/v1` (shim at `/api`).
    - Serves the built React app + assets via an embedded static bundle, with optional filesystem overrides via `KANBANAI_STATIC_DIR`, and SPA fallback for deep links.

## Logging

- Server logging uses Pino via `server/src/log.ts` with a base of `{service: "kanban-ai-server"}` and writes structured JSON to stdout/stderr (same in compiled binaries).
- Control verbosity with `LOG_LEVEL` (`debug` | `info` | `warn` | `error`, default `info`).
- Per-request Hono traces are opt-in; enable them with `KANBANAI_DEBUG=1`, `DEBUG=*`/`DEBUG=kanbanai*`, or by raising `LOG_LEVEL` to `debug`.
- Examples:
  ```
  LOG_LEVEL=info bun run prod                       # structured logs, no per-request traces
  LOG_LEVEL=debug KANBANAI_DEBUG=1 bun run prod     # structured logs + Hono request lines
  ```

## Configuration

Project Settings (per project): base branch, preferred remote, setup/dev/cleanup scripts, default agent/profile,
auto-commit-on-finish (automatically triggers an autocommit when a successful attempt finishes) with optional auto-push.

Agent profiles can be stored per project or as workspace-global entries (IDs beginning with `apg-`). When an attempt
starts or resumes, the server now resolves the referenced profile, validates it against the agent’s schema, and logs an
info message when a named profile is used. Missing, mismatched, or invalid profile JSON automatically falls back to the
agent’s default profile with a warning, so attempts continue without manual cleanup.

Database: SQLite via `bun:sqlite` managed by Drizzle. Migrations run automatically on server start; the default database
lives in your OS application data directory (e.g., `~/.local/share/kanbanai/kanban.db` on Linux, `%LOCALAPPDATA%/KanbanAI`
on Windows). Override with `DATABASE_URL` (`file:/absolute/path` or `sqlite:/absolute/path`).

Static assets & migrations (single-origin binary): the compiled binary embeds the Drizzle migrations and the contents of `server/static` by default, so the executable is self-contained. You can still override with `KANBANAI_MIGRATIONS_DIR` and/or `KANBANAI_STATIC_DIR` to point at external folders (e.g., custom branding or out-of-band migrations).

Worktrees: created under `$HOME/.kanbanAI/worktrees`. Moving a ticket to **Done** now removes its attempt branch and
worktree automatically; project deletion also purges associated worktrees.

## API (selected)

All endpoints are rooted at `/api/v1` (temporary shim also available at `/api`). Project resources now expose a
`boardId` (currently the same as `id`) so every board-scoped action can consistently target `/boards/:boardId/*`
or the nested alias `/projects/:projectId/board/*`.

- GitHub auth: `POST /auth/github/device/start`, `POST /auth/github/device/poll`, `GET /auth/github/check`,
  `POST /auth/github/logout`, `GET/PUT /auth/github/app`
- Onboarding state: `GET /onboarding/status`, `PATCH /onboarding/progress`, `POST /onboarding/complete`
- Projects: `GET/POST /projects`, `GET /projects/:projectId`, `GET/PATCH /projects/:projectId/settings`,
  `GET /projects/:projectId/github/origin`
- Boards: `GET /boards/:boardId`, `POST /boards/:boardId/cards`, `PATCH /boards/:boardId/cards/:cardId`
  (content updates, dependency changes, and card moves), `DELETE /boards/:boardId/cards/:cardId`,
  `POST /boards/:boardId/import/github/issues` (board-scoped attempt creation is deprecated; use the project route below)
- Card moves now piggyback on the `PATCH /boards/:boardId/cards/:cardId` endpoint by supplying both `columnId`
  and `index`; successful moves respond with the patched card plus updated column snapshots so the client can
  update the local board state without a refetch.
- Attempts: `POST /projects/:projectId/cards/:cardId/attempts` (canonical), `GET /projects/:projectId/cards/:cardId/attempt`
  for latest attempt + logs/messages, `GET /attempts/:id`, `PATCH /attempts/:id` with `{status:"stopped"}` to stop,
  `POST /attempts/:id/messages` for follow-ups, `GET /attempts/:id/logs`. Older `/attempts/boards/*` and
  `/attempts/:id/stop` paths now return HTTP 410 with pointers to the canonical shape.
- Attempt Git: `GET /attempts/:id/git/status`, `GET /attempts/:id/git/file`,
  `POST /attempts/:id/git/commit|push|merge`
- Pull Requests: `GET /projects/:projectId/pull-requests?branch=&state=open|closed|all`,
  `GET /projects/:projectId/pull-requests/:number`,
  `POST /projects/:projectId/pull-requests` (accepts optional `branch`, `attemptId`, and `cardId`
  so PRs can be tied back to board cards). The legacy `/projects/:projectId/github/pr` route has been
  retired.

Types for requests/responses and WebSocket messages are exported from the `shared` package.

## Tech Stack

- Bun runtime and package manager
- Hono web framework (server)
- React + Vite (client), shadcn/ui, TanStack Query
- Drizzle ORM + bun:sqlite
- simple‑git for Git operations
- Turbo for monorepo orchestration

## License

MIT © 2025 Steve Simkins

## Deployment

- Development:
  - `bun run dev` — runs Vite dev server (client) and Hono API server separately via Turbo.
  - `bun run dev:client` — client only.
  - `bun run dev:server` — API server only (no static file serving).

- Single-origin self-hosting:
  - `bun run prod`:
    - Builds client (`client/dist`) and server.
    - Copies `client/dist` into `server/static`.
    - Generates the embedded static bundle used by the prod entry.
    - Starts a single Hono/Bun server that serves:
      - API under `/api/v1` (shim at `/api`).
      - The built React app and assets (from the embedded bundle, with filesystem overrides when `KANBANAI_STATIC_DIR` is set) with SPA fallback.

  - `bun run build:binary`:
    - Builds the production bundle and emits self-contained executables:
      - `dist/kanban-ai-linux-x64`
      - `dist/kanban-ai-linux-arm64`
      - `dist/kanban-ai-darwin-arm64`
      - `dist/kanban-ai-win-x64.exe`
    - Each binary serves the API + UI on a single origin, using embedded static assets and migrations by default.

  - Configure `PORT`, `HOST`, `DATABASE_URL`, `KANBANAI_MIGRATIONS_DIR`, and `KANBANAI_STATIC_DIR` as needed.
