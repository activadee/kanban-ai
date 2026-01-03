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
  - Subsequent edits to the ticket’s title or description automatically PATCH the exported GitHub issue to stay in sync.
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
   - `autoCloseTicketOnIssueClose: boolean` – automatically move cards to Done when their linked GitHub issue is closed (default `false`).
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
- The Project Settings UI also surfaces aggregated counts of linked issues (`imported`, `exported`, `total`) by calling `/boards/:boardId/github/issues/stats`
  when the GitHub connection and board context are available, so you can see how many issues have already been synced or exported.
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
  - `POST /projects/:projectId/pull-requests/summary` – uses the configured inline agent/profile to summarize the diff between a base and head branch, returning `{summary: {title, body}}` for the Create PR dialog; you can pass `attemptId`/`cardId` so linked GitHub issues are detected and the returned body can append auto-close lines (e.g. `closes #123, fixes #456`).
  - The client caches inline summary results per project + branch so users can trigger a summary, close the PR dialog, and return later to apply the cached suggestion; cancellation is explicit (AbortController) rather than tied to dialog lifecycle.

### Auto‑close tickets on PR merge

- Projects can opt into automatic ticket closure when PRs are merged:
   - `autoCloseTicketOnPRMerge: boolean` (default `false`).
- When enabled, a lightweight background scheduler periodically scans cards in the **Review** column that have a linked `prUrl`.
- If a linked PR is **closed and merged**, the card is automatically moved to the **Done** column.
- The scheduler currently identifies these columns by title, so your board must contain columns titled **Review** and **Done**.
- You can disable this on a per‑ticket basis by setting:
   - `disableAutoCloseOnPRMerge: boolean` on the card (default `false`).

### Auto‑close tickets on GitHub issue close

- Projects can opt into automatic ticket closure when linked GitHub issues are closed:
   - `autoCloseTicketOnIssueClose: boolean` (default `false`).
- When enabled, a lightweight background scheduler periodically scans cards that have a linked GitHub issue.
- If a linked issue is **closed**, the card is automatically moved to the **Done** column.
- The scheduler currently identifies the **Done** column by title, so your board must contain a column titled **Done**.
- This feature works for both:
   - Cards imported from GitHub issues (via background sync or manual import).
   - Cards exported to GitHub issues (created via the Create Ticket dialog with the GitHub issue creation option enabled).
- You can disable this on a per‑ticket basis by setting:
   - `disableAutoCloseOnIssueClosed: boolean` on the card (default `false`).
