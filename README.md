# KanbanAI

Developer‑centric Kanban that turns tasks into Pull Requests with help from your favorite coding agent. Built with Bun,
Hono, React, and Vite in a type‑safe monorepo with shared models and a realtime board.

## Features

- Kanban board with Backlog / In Progress / Review / Done.
- GitHub device‑flow login, issue import, and PR creation from the app.
- Per‑task Attempts that run inside isolated git worktrees under `$HOME/.cache/kanban-ai/worktrees/...`.
- Diff viewer, commit/push, and PR helpers wired into each Attempt.
- Agent profiles (e.g., Codex via SDK) with configurable models and sandbox settings.

## Monorepo layout

```
.
├── cli/      # kanban-ai npm package (downloads/runs the published binary)
├── client/   # React + Vite app (UI)
├── server/   # Hono API + agents + Git/GitHub integrations
├── shared/   # Shared TypeScript types and agent interfaces
└── docs/     # Mintlify documentation (product + dev docs)
```

## Requirements

- Git 2.40+  
- Bun 1.3.3+ (repo is configured for `bun@1.3.3`)

## Quick start (local dev)

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start dev servers (API + UI via Turbo):

   ```bash
   bun run dev
   ```

   - UI: `http://localhost:5173`  
   - API: `http://localhost:3000/api/v1` (shim also at `/api`)

3. On first launch, the UI redirects to `/onboarding` to collect preferences, Git defaults, GitHub templates, and GitHub
   OAuth credentials before dropping you into the workspace.

For full local‑dev and environment configuration details, see `docs/guides/local-dev.md`.

## Scripts

- `bun run dev` – dev API + UI (recommended for development).
- `bun run dev:server` – API server only.
- `bun run dev:client` – Vite UI only.
- `bun run prod` – single‑origin prod server (build client + server, then serve both on one port).
- `bun run build:binary` – build self‑contained binaries for common platforms.

CLI and deployment details live in `docs/ops/cli-and-binaries.md`.

## Documentation

The full product and technical documentation lives under `docs/` and is powered by Mintlify:

- `docs/index.mdx` – high‑level overview and core features.
- `docs/core/*.md` – product features (projects, boards, Attempts, agents, Git/GitHub, dashboard, settings, QoL).  
- `docs/guides/*.md` – guides such as onboarding and local development.  
- `docs/ops/*.md` – operations docs (CLI wrapper, prod server, binaries).

To run the docs locally:

```bash
npm install -g mint
cd docs
mint dev
```

Then open the local URL printed by Mint.

## License

MIT
