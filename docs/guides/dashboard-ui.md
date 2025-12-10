---
title: Dashboard (UI)
---

# Dashboard (UI)

The Dashboard page gives you a high-level view of projects, Attempts, and system status. This guide explains each panel.

## Accessing the Dashboard

- From the sidebar, click **Dashboard**.
- The Dashboard route is `/dashboard`.
- Under the hood it uses:
  - `GET /api/v1/dashboard` for the initial snapshot.
  - `/api/v1/ws/dashboard` to stream live updates.

## Metric cards

At the top of the page you’ll see four metric cards:

- **Projects** – number of boards/projects tracked.
- **Active Attempts** – Attempts currently `queued`, `running`, or `stopping`.
- **Attempts (range)** – Attempts that completed (succeeded, failed, or stopped) within the dashboard’s current time range (defaults to the last 24 hours when using the API without query args).
- **Open Cards** – cards on boards that are not in a Done column.

Use these to gauge workload and automation at a glance.

## Active Attempts panel

- Lists attempts that are currently in progress:
  - Shows card title/ticket key, project name, agent, and status.
  - Each row provides a link back to the project board/card.
- Status indicators:
  - Use the same status badges as elsewhere in the app.
  - Help you spot stuck or failing Attempts quickly.

When no Attempts are active, the panel shows an empty-state message.

## Recent activity panel

- Shows a timeline of recently completed Attempts:
  - Includes success, failure, and stopped outcomes.
  - Displays the relative time since completion (e.g. “3 minutes ago”).
- This is useful for:
  - Reviewing what agents have done recently.
  - Spotting patterns in failed Attempts.

## Project snapshot panel

- Lists a subset of projects with:
  - Name and repository slug/path.
  - Total cards.
  - Open cards (not in Done) and active Attempts per project.
- Each project name links to the corresponding board.

Use this to identify overloaded projects or boards with too many open cards or Attempts.

## System status panel

- **GitHub**:
  - Shows whether you are connected to GitHub.
  - When connected:
    - Displays the connected username.
  - When not connected:
    - Suggests opening onboarding or Settings → GitHub to connect.
- **Agents**:
  - Shows the number of registered agents.
  - Lists each agent with:
    - Attempts in the current Dashboard time range.
    - Success rate (as a percentage) for those attempts.
    - Last activity time derived from the latest attempt in range.
  - Agents that have no attempts within the selected time range are still shown, with a muted “inactive in this range” state so you can distinguish idle agents from those doing work.

This panel helps you quickly see whether core integrations (GitHub, agents) are ready before starting work.

## Inbox panel

- Surfaces actionable items coming from the shared `DashboardInbox` payload.
- Divided into three lists:
  - **Review** – succeeded Attempts that still require human verification (e.g. a PR is still open or the card is not in a Done column). Each entry shows the `reason`, linked PR (if any), and the most recent update timestamp.
  - **Failed** – Attempts that ended in failure without a later resolved success. These items surface a short `errorSummary` harvested from the latest log entries so you can triage what went wrong.
  - **Stuck** – Queued or running Attempts that exceeded the backend thresholds (roughly 10 minutes for queued work, 30 minutes for running). Each stuck item reports how long it has been stuck (`stuckForSeconds`) and links to the associated board/card for intervention.
- Items are sorted by recency (`lastUpdatedAt`) so the most urgent work appears at the top.
- Tapping an inbox entry opens the corresponding project/card view so you can inspect logs, PRs, or agent output before taking action.

## Version indicator

- A small inline indicator beside the Dashboard title shows the current server version (`vX.Y.Z`), or `Version unavailable`/`Checking version…` when the UI is still polling `GET /version`.
- When `/version` reports `updateAvailable: true`, the indicator surfaces a badge (`Update available — restart to apply`) so you know to restart KanbanAI to pick up the latest release.
