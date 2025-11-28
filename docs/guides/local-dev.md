# Local development

Last updated: 2025-11-28

## Prerequisites

- Git 2.40+  
- Bun 1.3.3+ (the repo is configured for this version)

## Install & run (dev)

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure environment (optional if you plan to enter most credentials during onboarding):

   - Server (`server/.env`):

     ```env
     # Optional if you plan to store credentials via onboarding/settings
     GITHUB_CLIENT_ID=your_github_oauth_app_client_id
     # Optional but recommended for higher limits
     GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

     # Optional: SQLite path (defaults to OS data dir, e.g., ~/.local/share/kanbanai/kanban.db)
     DATABASE_URL=sqlite:/absolute/path/to/kanban.db

     # Codex SDK (requires the Codex CLI to be installed and reachable on PATH)
     CODEX_API_KEY=your_codex_or_openai_api_key
     # Optional: override base URL or codex binary path
     # OPENAI_BASE_URL=https://api.openai.com/v1
     # CODEX_PATH=/custom/path/if/not_on_path
     # CODEX_PATH_OVERRIDE=/custom/path/to/codex # takes precedence over CODEX_PATH
     ```

   - Client (`client/.env`, optional unless you need a custom API origin):

     ```env
     # Optional: override the API base (dev defaults to http://localhost:3000/api/v1)
     VITE_SERVER_URL=http://localhost:3000/api/v1
     ```

3. Start dev servers:

   ```bash
   bun run dev
   ```

   - UI: `http://localhost:5173`  
   - API base: `http://localhost:3000/api/v1` (shim also at `/api`)

4. First-run onboarding:

   - On first launch, the UI redirects to `/onboarding` to collect:
     - Preferences (theme, language, telemetry, notifications)
     - Editor and Git defaults
     - GitHub templates and OAuth credentials
     - GitHub Device Flow connection
   - After completion, you land in the main workspace. You can revisit onboarding later at `/onboarding`.

## Dev-only scripts

- `bun run dev` – run API + UI via Turbo (recommended for normal development).  
- `bun run dev:server` – API server only (no static file serving).  
- `bun run dev:client` – Vite UI only.

For production and binary builds, see `ops/cli-and-binaries.md`.

