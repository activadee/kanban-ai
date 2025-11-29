# Onboarding & settings

Last updated: 2025-11-28

## First-run onboarding

- The first authenticated session is gated behind an onboarding wizard at `/onboarding` whenever no onboarding record
  exists in the local database.
- The wizard walks through:
  - General preferences – theme, language, telemetry, notifications.
  - Editor & Git defaults – preferred editor, git name/email, branch templates.
  - GitHub templates – PR title/body templates and autolink ticket settings.
  - GitHub OAuth setup – Client ID/secret for the OAuth App.
  - GitHub Device Flow – prompts you to complete the device flow so the sidebar and Dashboard can show a connected
    account immediately.
- Progress is auto-saved and the flow resumes where you left off after refreshes.
- On completion:
  - The onboarding state is marked `completed`.
  - Users are redirected into the main workspace where they can access Dashboard, Projects, and Settings.

For more detail on individual steps and backend schema, see `onboarding.md`.

## Global app settings

- App-wide settings are managed by the Settings module and live behind:
  - `GET /settings`
  - `PATCH /settings`
- The Settings service:
  - Lazily bootstraps defaults via `ensureAppSettings`.
  - Caches settings in memory.
  - Emits `settings.global.updated` on changes so caches and listeners can refresh.
- Settings include:
  - Theme and language.
  - Telemetry and notification preferences.
  - Editor defaults (used by the Editor module when opening worktrees).
  - Git defaults (e.g. preferred author configuration and auto-start behavior).

## Project settings overview

- Each project has its own Settings view, backed by the Projects settings service:
  - `GET /projects/:projectId/settings`
  - `PATCH /projects/:projectId/settings`
- Per-project settings cover:
  - Base branch and preferred remote.
  - Ticket key prefix and repository naming.
  - Default agent and agent profile for Attempts.
  - Inline agent and inline agent profile for inline actions (e.g. ticket enhancement).
  - Automation flags:
    - Auto-commit on successful Attempt completion.
    - Auto-push after auto-commit.
- These settings drive behaviors documented in:
  - **AI Attempts** – how Attempts behave and which agent/profile they use.
  - **Git integration** – when auto-commit/auto-push triggers.
  - **Quality-of-life** – auto-start Attempts when moving cards into In Progress.
