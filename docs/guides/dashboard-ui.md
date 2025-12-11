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
- The selected preset is remembered in browser session storage, so navigating away from and back to Mission Control (or soft reloading the page) keeps the last chosen time range for the current session.
- When the default preset is selected the live WebSocket stream stays connected; choosing a different preset keeps the stream untouched by using a separate cache entry for each range so you still see live updates when you switch back to **Last 7 days**.

## Metric cards

At the top of the page you’ll see five KPI cards that surface the headline aggregates from `DashboardOverview.metrics`:

- **Active attempts** – how many Attempts are currently `queued`, `running`, or `stopping`. The helper text “Currently in progress” emphasizes that this is a live count of in-flight work.
- **Attempts in range** – Attempts whose `createdAt` falls within the selected preset or custom window. The helper text “Within selected period” keeps the total tied to the visible filter.
- **Success rate** – Percentage of attempts in the selected range that succeeded (formatted as `xx%`). Its helper text changes to match the selected preset (e.g. “Last 7 days”), so you can quickly see the timeframe behind the ratio.
- **Items to review** – Count of inbox review items that still require human verification. It mirrors `DashboardInbox.review` plus any `meta.totalReview` count surfaced by the service.
- **Active projects** – Number of boards with any attempt activity in the selected range. This card only appears after the KPI snapshot loads; while the request is in flight you’ll see a loading skeleton instead.

The cards show a skeleton on first load, surface a small error banner with a retry action when the KPI request fails, and keep helper text tied to the selected preset so you can interpret the numbers at a glance.
When the KPI snapshot succeeds but reports zero counts across the supported metrics, Mission Control gently swaps in an empty-state message explaining that the cards will light up once agents start running attempts for the selected range.

## Live Agent Activity panel

- The **Live Agent Activity** card now focuses exclusively on live attempts that are queued, running, or stopping.
  - The **Active attempts** subsection lists those in-flight attempts with status badges, project/agent metadata, relative update timestamps, and quick links back to the board.
  - Dropdown filters let you scope the list by agent, attempt status (`queued`, `running`, `stopping`), and project, with a “Clear filters” button and a badge showing how many filters are active. Filters persist across live updates so you can keep a narrowed view even as new data streams in.
  - Click or press Enter/Space on any row to open the attempt detail page (`/attempts/:attemptId`) that contains the attempt summary, metadata, and streaming log chronicle alongside the board link that already existed.
  - When the dashboard WebSocket temporarily drops or reconnects, a helper note informs you that live updates are paused and the panel will resume with the latest cached snapshot once the socket returns.
  - Empty states explain when no live attempts match the current preset so you know why the list is blank.
  - When the live activity query fails and there are no cached attempts, a compact retryable error banner appears inside the card so you can refresh without blocking the rest of Mission Control; the empty-state messaging is suppressed until the list succeeds again.

## Recent Attempt History panel

- A new **Recent Attempt History** card surfaces completed and stopped attempts from across boards, ordered by most recent completion time within the selected timeframe.
  - Each row shows the attempt status badge, ticket title/key, project name, agent label (or `Unknown agent` fallback), formatted duration, and both absolute and relative timestamps, so you can quickly understand what ran and how long it took.
  - Rows are keyboard and mouse accessible: clicking (or pressing Enter/Space) navigates to the attempt detail, while project links jump straight to the associated board without losing focus.
  - The header mirrors the dashboard time range label for context, and a **Show more / Show less** footer lets you page through large histories while keeping the default viewport limited for readability.
  - Skeletons render while the history data is loading, an inline error banner with a retry button appears when the fetch fails, and a friendly empty-state message explains that no attempts have completed yet when the list is blank.

## Project Health panel

- The **Project Health** card summarizes each project’s workload for the selected time range.
  - Rows include the project name, repository slug/path, total cards, open cards, column breakdowns, and active attempts.
  - A **Sort by** control lets you order projects by open cards or failed attempts within the current range so you can focus on either volume or risk.
  - Badge indicators surface high activity or high failure rates with tooltips that explain what triggered the highlight, and each row shows open/total card counts plus recent attempts/failures for the chosen preset.
  - Clicking (or pressing Enter/Space on) a row jumps straight to that board so you can investigate the project quickly.
  - Empty state encourages creating a project to populate the list.
  - When the project snapshots request fails, the card shows an inline retryable error banner without hiding the sort controls so you can try again without leaving Mission Control.
- Use this to identify overloaded boards or projects with too much open work, failed attempts, or queued attempts during the chosen window.

## Agents & System panel

- The panel now renders the new **AgentsSystemStatusPanel**, which blends a readiness indicator, GitHub integration state, and an agent fleet snapshot for the selected time range.
  - The **System readiness** subsection exposes a tone-aware badge plus helper text that explains whether GitHub and agents are configured, active, or degraded, and it surfaces quick links to **View agents** and **Integration settings** so you can act without leaving Mission Control.
  - The **GitHub integration** subsection reports the current connection status (connected, disconnected, error, or unknown), highlights the connected account when available, and shows either a **Manage GitHub** or **Connect GitHub** button depending on the state. Errors and loading states display inline guidance plus a retry link so you can refresh the status on demand.
  - The **Agent fleet** subsection summarizes how many agents are registered, whether any handled attempts during the selected window, and whether additional retries are needed when the dashboard or agent queries fail. When agent stats are available, the panel lists up to eight agents ordered by last activity, surfaces the formatted success rate, and shows relative last-activity timestamps with tooltips containing the exact time. Idle or inactive agents remain visible with muted styling so you can still compare who is online versus who needs work.
- Error handling is non-blocking: GitHub or agent fetch failures render contextual banners with retry buttons, while empty states remind you to register agents or wait for attempts to appear in the chosen timeframe.

## Inbox panel

- Surfaces actionable items coming from the shared `DashboardInbox` payload.
- Divided into three lists:
  - **Review** – succeeded attempts that still require human verification (e.g. a PR is still open or the card is not in a Done column).
  - **Failed** – attempts that ended in failure without a later resolved success.
  - **Stuck** – queued or running attempts that exceeded the backend thresholds (roughly 10 minutes for queued work, 30 minutes for running).
- Items are sorted by recency (`lastUpdatedAt`) so the most urgent work appears at the top, and each row surfaces the related card, project, agent (or agent ID fallback), relative last activity timestamp, and the attempt’s status badge.
- Tabs at the top of the panel let you toggle between **All**, **Review**, **Failed**, or **Stuck** items while showing counts for each category. The selected filter is remembered for the current browser session so you can keep focused on one bucket while you flip between attempts or revisit Mission Control.
- A refresh button is exposed beside the tabs in case you need an on-demand reload, while the panel renders skeleton placeholders during the initial load and surfaces a retryable error banner if the dashboard fetch fails.
- Tapping an inbox entry opens the corresponding attempt detail page so you can inspect logs, PRs, or agent output before taking action.
- Each row is keyboard accessible and exposes inline actions: click the attempt icon to land on the attempt detail page, open the PR in a new tab when a `prUrl` is available, or retry a failed item directly from the panel (the retry action re-queues the agent and refreshes the inbox).

## Version indicator

- A small inline indicator beside the title surfaces the current server version (`vX.Y.Z`), or `Version unavailable`/`Checking version…` while the UI polls `GET /version`.
- When `/version` reports `updateAvailable: true`, the indicator shows a badge (`Update available — restart to apply`) so you know to restart KanbanAI to pick up the latest release.
