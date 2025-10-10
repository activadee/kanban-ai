# KanbanAI

Some stuff added to see if the stuff works
Developer‑centric Kanban that turns tasks into Pull Requests with help from your favorite coding agent. Built with Bun +
Hono + React + Vite in a type‑safe monorepo, with shared models and a realtime board.

Built on the bhvr monorepo template.

## Highlights

- Kanban board with Backlog / In Progress / Review / Done
- GitHub device‑flow login, import issues as tasks, and create PRs from the app
- Per‑task Attempts run inside isolated git worktrees under `$HOME/.kanbanAI/worktrees/...`
- Diff viewer, stage/commit, push, Create PR, and optional auto‑merge to base
- Agent profiles (e.g., Codex) with customizable command/env settings
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

1. Install dependencies

```bash
bun install
```

2. Configure environment

- Server (`server/.env`):

```env
# Required for GitHub OAuth Device Flow
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
# Optional but recommended for higher limits
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

# Optional: SQLite path (defaults to file:./drizzle/kanban.db)
DATABASE_URL=file:./drizzle/kanban.db
```

- Client (`client/.env`):

```env
VITE_SERVER_URL=http://localhost:3000
```

3. Start everything (Turbo will run client and server)

```bash
bun run dev
```

- UI: http://localhost:5173
- API: http://localhost:3000 (health: `/` → “KanbanAI server is running”)

## GitHub OAuth (Device Flow)

KanbanAI uses GitHub’s Device Authorization Flow — no callback server is required.

1. Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps), enable “Device Flow”, and copy the Client
   ID (and Secret).
2. Put `GITHUB_CLIENT_ID` (and optionally `GITHUB_CLIENT_SECRET`) in `server/.env`.
3. In the app, open the GitHub panel (sidebar → GitHub) and click “Connect”. You’ll be shown a user code and
   verification URL to confirm in the browser.

Scopes requested: `repo`, `read:user`, `user:email`.

## Typical Flow

1. Create a Project pointing to a local git repo (or initialize one).
2. Connect GitHub and (optionally) import issues to populate the board.
3. Drag a ticket to In Progress to start an Attempt. The server creates a worktree at
   `$HOME/.kanbanAI/worktrees/<project>/<task>` and launches your selected agent.
4. Review changes: view diffs, stage/commit, push, and Create PR.
5. When merged, move to Done. Worktrees remain available for manual inspection or cleanup.

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

- GitHub device flow: `POST /auth/github/device/start`, `POST /auth/github/device/poll`, `GET /auth/github/check`,
  `POST /auth/github/logout`
- Projects: `GET/POST /projects`, `GET /projects/:id`, `GET/PATCH /projects/:id/settings`,
  `GET /projects/:id/github/origin`, `POST /projects/:id/import/github/issues`
- Attempts: `POST /attempts/projects/:boardId/cards/:cardId/attempts`, `GET /attempts/:id`, `POST /attempts/:id/stop`,
  `GET /attempts/:id/logs`
- Attempt Git: `GET /attempts/:id/git/status`, `GET /attempts/:id/git/file`,
  `POST /attempts/:id/git/stage|unstage|commit|push|merge`, `POST /attempts/:id/github/pr`

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

## Binary Releases

You can build a single binary that serves the API at `/api/*` and the SPA at `/app`.

Build (local platform only):

- `bun run package` – builds the client, embeds assets and migrations, and compiles `dist/kanbanai`.

Run:

- `./dist/kanbanai [--host 127.0.0.1] [--port 3000] [--open] [--no-open]`

## Run via Package Runner

You can also run the packaged CLI without a global install using a standard package runner:

- `bunx kanban-ai` — starts the server on `127.0.0.1:3000` and prints the URL.
- `bunx kanban-ai --port 5555 --open` — starts on port 5555 and opens the browser.

If the binary is missing for your platform, build it locally:

```bash
bun run package
```

Behavior:

- REST: `/api/*` (projects, agents, attempts, settings, github, filesystem, dashboard, metrics at `/api/metrics`).
- WebSockets: `/api/ws` and `/api/ws/dashboard`.
- Client: `/app` with assets under `/app/assets/*` and index.html fallback (deep links like `/app/projects`).
- No external files required next to the binary. Client assets and SQL migrations are embedded at build time.
- SQLite database location (always OS default):
  - macOS: `~/Library/Application Support/KanbanAI/kanban.db`
  - Windows: `%LOCALAPPDATA%/KanbanAI/kanban.db`
  - Linux: `$XDG_DATA_HOME/kanbanai/kanban.db` or `~/.local/share/kanbanai/kanban.db`

Client defaults for the binary:

- `vite.config.ts` uses `base: "/app/"`.
- Router `BrowserRouter` uses `basename="/app"`.
- `SERVER_URL` defaults to `http://localhost:3000/api` (override via `VITE_SERVER_URL`).

Notes:

- In dev, the server serves from the filesystem; the embedded assets are used in packaged binaries.
- Metrics are available only at `/api/metrics`.
