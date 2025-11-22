# KanbanAI

Developer‑centric Kanban that turns tasks into Pull Requests with help from your favorite coding agent. Built with Bun +
Hono + React + Vite in a type‑safe monorepo, with shared models and a realtime board.

Built on the bhvr monorepo template.

## Highlights

- Kanban board with Backlog / In Progress / Review / Done
- GitHub device‑flow login, import issues as tasks, and create PRs from the app
- Per‑task Attempts run inside isolated git worktrees under `$HOME/.kanbanAI/worktrees/...`
- Diff viewer, stage/commit, push, Create PR, and optional auto‑merge to base
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
- Bun 1.2.4+ (repo is configured for `bun@1.2.4`)

## Quick Start (Local Dev)

1) Install dependencies

```bash
bun install
```

2) Configure environment

- Server (`server/.env`):

```env
# Required for GitHub OAuth Device Flow
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
# Optional but recommended for higher limits
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

# Optional: SQLite path (defaults to file:./drizzle/kanban.db)
DATABASE_URL=file:./drizzle/kanban.db

# Codex SDK
CODEX_API_KEY=your_codex_or_openai_api_key
# Optional: override base URL or codex binary path
# OPENAI_BASE_URL=https://api.openai.com/v1
# CODEX_PATH_OVERRIDE=/custom/path/to/codex
```

- Client (`client/.env`):

```env
VITE_SERVER_URL=http://localhost:3000/api/v1
```

3) Start everything (Turbo will run client and server)

```bash
bun run dev
```

- UI: <http://localhost:5173>
- API (base): <http://localhost:3000/api/v1> (shim also at `/api`)

Note: the API server no longer serves the built client. Run the Vite dev server for UI during development (`bun run dev:client`) and host `client/dist` separately for production.

## GitHub OAuth (Device Flow)

KanbanAI uses GitHub’s Device Authorization Flow — no callback server is required.

1) Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps), enable “Device Flow”, and copy the Client
   ID (and Secret).
2) Put `GITHUB_CLIENT_ID` (and optionally `GITHUB_CLIENT_SECRET`) in `server/.env`.
3) In the app, open the GitHub panel (sidebar → GitHub) and click “Connect”. You’ll be shown a user code and
   verification URL to confirm in the browser.

Scopes requested: `repo`, `read:user`, `user:email`.

## Typical Flow

1) Create a Project pointing to a local git repo (or initialize one).
2) Connect GitHub and (optionally) import issues to populate the board.
3) Drag a ticket to In Progress to start an Attempt. The server creates a worktree at
   `$HOME/.kanbanAI/worktrees/<project>/<task>` and launches your selected agent.
4) Review changes: view diffs, stage/commit, push, and Create PR.
5) When merged, move to Done. Worktrees remain available for manual inspection or cleanup.

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
```

## Configuration

Project Settings (per project): base branch, preferred remote, setup/dev/cleanup scripts, default agent/profile,
auto‑commit‑on‑finish.

Database: SQLite via `bun:sqlite` managed by Drizzle. Migrations run automatically on server start; default file lives
at `server/drizzle/kanban.db` (configurable with `DATABASE_URL`).

Worktrees: created under `$HOME/.kanbanAI/worktrees`. Remove them manually when no longer needed; project deletion also
purges associated worktrees.

## API (selected)

All endpoints are rooted at `/api/v1` (temporary shim also available at `/api`).

- GitHub device flow: `POST /auth/github/device/start`, `POST /auth/github/device/poll`, `GET /auth/github/check`,
  `POST /auth/github/logout`
- Projects: `GET/POST /projects`, `GET /projects/:id`, `GET/PATCH /projects/:id/settings`,
  `GET /projects/:id/github/origin`, `POST /projects/:id/import/github/issues`
- Attempts: `POST /attempts/projects/:boardId/cards/:cardId/attempts`, `GET /attempts/:id`, `POST /attempts/:id/stop`,
  `GET /attempts/:id/logs` (`POST /attempts/:id/stop` now force-stops attempts stuck in running/queued states even if
  the worker process is no longer tracked)
- Attempt Git: `GET /attempts/:id/git/status`, `GET /attempts/:id/git/file`,
  `POST /attempts/:id/git/commit|push|merge`, `POST /attempts/:id/github/pr`

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

- Build client: `bun run build:client` (outputs to `client/dist`). Serve those static files with your preferred web host.
- Run API: `bun run dev:server` for development, or `bun run start:server -- --host 0.0.0.0 --port 3000` under your process manager for production.
- API endpoints and WebSockets remain at `/api/v1/*` (shimmed at `/api/*`). Metrics at `/api/v1/metrics`.
