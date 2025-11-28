# Onboarding Guide (KanbanAI)

Last updated: 2025-11-22

## Purpose
First‑run flow that captures the user’s preferences and connects GitHub before entering the workspace. The flow only shows when no onboarding record exists in the local database.

## User experience (client)
Route: `/onboarding`

Steps:
1) Welcome  
2) General preferences (theme, language, telemetry, notifications, auto-start agent on In Progress)  
3) Editor + Git defaults (default editor, git name/email, branch template)  
4) GitHub templates + OAuth app credentials (PR title/body templates, autolink tickets, GitHub client ID + secret)  
5) Connect GitHub (device flow; shows device code, opens GitHub verification link)  
6) Finish (summary and link into the app)

Access control:
- `App` uses `RequireOnboardingComplete` to redirect pending users to `/onboarding`.
- After completion, users land on `/` and can revisit settings at `/settings`.

Components: shadcn UI, existing settings sections reused; new `GithubAppCredentialsFields` component for OAuth keys.

## Backend
Tables (SQLite):
- `onboarding_state` (`id` singleton, `status`, `last_step`, `completed_at`, timestamps)
- `github_app_configs` (`id` singleton, `client_id`, `client_secret`, timestamps)

Services:
- `onboardingService` (get, record progress, complete)
- `githubRepo` now handles GitHub app config (upsert/read) in addition to connection tokens.

GitHub device flow:
- Uses stored client ID/secret first; falls back to `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` env vars.

## API surface
- `GET  /api/v1/onboarding/status` → `{status}`
- `PATCH /api/v1/onboarding/progress` body `{step?: string}`
- `POST /api/v1/onboarding/complete` body `{step?: string}`
- `GET  /api/v1/auth/github/app` → GitHub app config (source `db|env|unset`, `hasClientSecret`)
- `PUT  /api/v1/auth/github/app` body `{clientId: string, clientSecret?: string|null}`
- Existing GitHub device endpoints unchanged: `/auth/github/device/start`, `/auth/github/device/poll`, `/auth/github/check`

## Data flow & caching
- React Query keys:
  - Onboarding status: `['onboarding','status']`
  - GitHub app config: `['github','app-config']`
- Progress recorded when step changes; completion marks onboarding state as `completed`.

## Migration
- New SQL migration: `server/drizzle/0007_onboarding_and_github_app.sql`
- Dev server auto-runs migrations; ensure it has executed before testing the flow.

## Developing / testing
1) Run server & client: `bun run dev` (monorepo) or `bun run dev:server` + `bun run dev:client`.
2) Clear onboarding (optional): delete `onboarding_state` row from local SQLite (`~/.local/share/kanbanai/kanban.db`) to re-trigger flow.
3) Walk through `/onboarding`, provide GitHub client ID/secret, connect via device flow, then confirm redirect to projects.

## Notes
- Secrets are stored locally; no remote storage.
- GitHub connection can also be initiated later from sidebar GitHub box or Settings.***
- Auto-start agent on In Progress defaults to off; onboarding surfaces the toggle so teams can opt into automatic attempt creation when moving cards from Backlog to In Progress.
