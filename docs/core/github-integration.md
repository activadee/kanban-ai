# GitHub Integration

Last updated: 2025-12-03

## Overview

KanbanAI integrates with GitHub to:

- Authenticate users via the OAuth **Device Authorization Flow**.
- Import issues into project boards as cards.
- Automatically sync issues in the background for projects that opt in.
- Optionally create GitHub issues when you create new tickets, keeping them linked.
- Create pull requests from attempt branches, keeping tickets, attempts, and PRs linked.

## OAuth App & credentials

- KanbanAI expects a GitHub OAuth App with Device Flow enabled.
- You can provide the OAuth **Client ID** and **Client Secret** in three ways:
  - During onboarding (`/onboarding`).
  - From Settings → App → GitHub OAuth App.
  - Via environment variables in `server/.env`:
    - `GITHUB_CLIENT_ID`
    - `GITHUB_CLIENT_SECRET`
- Credentials are stored locally in SQLite; there is no remote storage.
- When both DB config and environment variables are present, the server prefers the stored configuration and falls back to env only when necessary.

## Device Authorization Flow

The GitHub module implements Device Flow using dedicated endpoints:

- `POST /auth/github/device/start`
  - Starts the device flow and returns a `device_code`, `user_code`, and verification URL.
- `POST /auth/github/device/poll`
  - Polls GitHub until the user completes verification in the browser.
  - On success, stores tokens and emits `github.connected`.
- `GET /auth/github/check`
  - Returns the current connection status for the sidebar and settings UI.
- `POST /auth/github/logout`
  - Revokes stored credentials and emits `github.disconnected`.

Additional configuration endpoints:

- `GET /auth/github/app` – returns the effective GitHub OAuth App configuration and whether it came from the DB or env.
- `PUT /auth/github/app` – updates the stored OAuth App config (`clientId`, `clientSecret`).

## Importing and syncing issues

- Once GitHub is connected, you can import issues into a project’s board:
  - `POST /projects/:projectId/board/import/github/issues`
  - or `POST /boards/:boardId/import/github/issues`
- The import service:
  - Fetches issues from the configured repository.
  - Creates or updates cards on the target board.
  - Emits `github.issues.imported` with the number of issues processed.
- Imported cards retain links back to the originating GitHub issues so you can navigate between the board and GitHub.
- When **GitHub Issue Creation** is enabled in a project’s settings, the Create Ticket dialog exposes a per‑ticket **Create GitHub Issue** checkbox.
  - If checked, KanbanAI creates a new issue in the project’s origin repository using the ticket title and description.
  - The created issue is stored in `github_issues` with `direction = 'exported'`, so the card displays a clickable `#<issueNumber>` badge.
  - If issue creation fails, the ticket is still created and the client shows an error toast.

### Background Issue Sync

- Each project has optional GitHub Issue Sync settings, exposed via:
  - `GET /projects/:projectId/settings`
  - `PATCH /projects/:projectId/settings`
- Settings live alongside other project settings:
  - `githubIssueSyncEnabled: boolean` – opt in/out of automatic sync (default `false`).
  - `githubIssueSyncState: 'open' | 'all' | 'closed'` – which issue states to sync (default `open`).
  - `githubIssueSyncIntervalMinutes: number` – how often to sync (default `15`, min `5`, max `1440`).
  - `githubIssueAutoCreateEnabled: boolean` – enables per‑ticket GitHub issue creation (default `false`).
- When enabled and a valid GitHub connection + origin (`owner/repo`) exist:
  - A lightweight scheduler in the server periodically selects eligible projects.
  - For each project, it checks the last sync metadata stored in `project_settings`:
    - `lastGithubIssueSyncAt: Date | null`
    - `lastGithubIssueSyncStatus: 'idle' | 'running' | 'succeeded' | 'failed'`
  - If the interval has elapsed and no sync is currently running, it calls `importGithubIssues` with the configured state.
- Sync runs are fully logged via the structured server logger using the `github:sync` scope, including:
  - Start/end of each scheduled sync run with project + repo context.
  - Counts of new/updated/skipped issues.
  - Per-issue logging when cards are created or updated.
- Cards that are mapped in `github_issues` expose a `#<issueNumber>` badge in the board and inspector UI; clicking it opens the GitHub issue in a new tab.

## Pull requests

- Attempts and projects can create pull requests through project-scoped endpoints:
  - `POST /projects/:projectId/pull-requests`
  - `GET /projects/:projectId/pull-requests`
  - `GET /projects/:projectId/pull-requests/:number`
- When creating a PR, the payload can include:
  - `branch` – the attempt or feature branch to PR.
  - `attemptId` – associates the PR with an Attempt.
  - `cardId` – links the PR back to a board card.
- The PR helper emits `github.pr.created` so other modules can react (for example, refreshing PR lists or updating activity feeds).
- For inline PR summaries (title + body suggestions), the API also exposes:
  - `POST /projects/:projectId/pull-requests/summary` – uses the configured inline agent/profile to summarize the diff between a base and head branch, returning `{summary: {title, body}}` for the Create PR dialog.
  - The client caches inline summary results per project + branch so users can trigger a summary, close the PR dialog, and return later to apply the cached suggestion; cancellation is explicit (AbortController) rather than tied to dialog lifecycle.
