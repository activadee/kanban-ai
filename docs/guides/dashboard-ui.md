---
title: Dashboard (UI)
---

# Dashboard (UI)

Presented as **Mission Control** in the app header, this page gives you a high-level view of projects, agent activity, and system health. This guide explains what each metric and panel does.

## Accessing the Dashboard

- From the sidebar, click **Dashboard**.
- The Dashboard route is `/dashboard`.
- Under the hood it uses:
  - `GET /api/v1/dashboard` for the initial snapshot.
  - `/api/v1/ws/dashboard` to stream live updates.
- The page header now labels the experience **Mission Control** while the route and API surface remain the same, and the time range selector sits beside the action buttons so you can scope the entire snapshot before diving in.

## Time range selector

- The drop-down beside the primary actions lets you scope Mission Control to one of the supported presets (`Last 24 hours`, `Last 7 days`, `Last 30 days`).
- The default preset is **Last 7 days**; changing it refetches the HTTP snapshot, keeps a dedicated query key, and rerenders the metric cards, inbox items, project snapshots, and agent stats for that window.
- When the default preset is selected the live WebSocket stream stays connected; choosing a different preset keeps the stream untouched by using a separate cache entry for each range so you still see live updates when you switch back to **Last 7 days**.

## Metric cards

At the top of the page you’ll see four metric cards:

- **Projects** – number of boards/projects tracked.
- **Active Attempts** – Attempts currently `queued`, `running`, or `stopping`.
- **Attempts (range)** – Attempts that completed (succeeded, failed, or stopped) within the selected time range. The label reflects the preset (e.g. “Attempts (Last 7 days)” by default) so you can correlate the total with the time window you’re viewing.
- **Open Cards** – cards on boards that are not in a Done column.

Use these to gauge workload and automation at a glance.

## Live Agent Activity panel

- The **Live Agent Activity** card merges in-flight work and recent outcomes.
  - The **Active attempts** subsection lists running/queued attempts with status badges, project/agent metadata, relative update timestamps, and quick links back to the project.
  - The **Recent activity** subsection shows completed/stopped attempts in the same time range, with relative timestamps and links to the originating boards.
- Both subsections honor the selected preset so you can match the timeline with the corresponding “Attempts (range)” total.
- Empty-state copy appears for each subsection when no data is available in the chosen window.

## Project Health panel

- The **Project Health** card summarizes each project’s workload for the selected time range.
  - Rows include the project name, repository slug/path, total cards, open cards, and active attempts.
  - Each project name links straight to the board.
  - Empty state encourages creating a project to populate the list.
- Use this to identify overloaded boards or projects with too much open work or queued attempts during the chosen window.

## Agents & System panel

- Updated from the legacy System status card, **Agents & System** highlights GitHub connectivity and agent activity in the selected range.
  - GitHub status blocks show whether you’re connected and which account is active, or direct you to onboarding/settings when disconnected.
  - Agent stats reflect the current preset: attempts started in range, success rate, and last activity timestamp.
  - Agents with no attempts in range still appear with a muted “inactive in this range” label so you can tell idle agents apart from active ones.
- This panel gives you confidence that your integrations and agents are ready before launching new work in the chosen timeframe.

## Inbox panel

- Surfaces actionable items coming from the shared `DashboardInbox` payload.
- Divided into three lists:
  - **Review** – succeeded attempts that still require human verification (e.g. a PR is still open or the card is not in a Done column). Each entry shows the `reason`, linked PR (if any), and the most recent update timestamp.
  - **Failed** – attempts that ended in failure without a later resolved success. These items surface a short `errorSummary` harvested from the latest log entries so you can triage what went wrong.
  - **Stuck** – queued or running attempts that exceeded the backend thresholds (roughly 10 minutes for queued work, 30 minutes for running). Each stuck item reports how long it has been stuck (`stuckForSeconds`) and links to the associated board/card for intervention.
- Items are sorted by recency (`lastUpdatedAt`) so the most urgent work appears at the top.
- Tapping an inbox entry opens the corresponding project/card view so you can inspect logs, PRs, or agent output before taking action.

## Version indicator

- A small inline indicator beside the title surfaces the current server version (`vX.Y.Z`), or `Version unavailable`/`Checking version…` while the UI polls `GET /version`.
- When `/version` reports `updateAvailable: true`, the indicator shows a badge (`Update available — restart to apply`) so you know to restart KanbanAI to pick up the latest release.
