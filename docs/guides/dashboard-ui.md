---
title: Mission Control dashboard
---

# Mission Control dashboard

Mission Control is the main operational dashboard for KanbanAI. It gives you a high‑level view of active work, project health, and system status so you can see what agents are doing and what needs your attention.

## What Mission Control is for

- **Primary use cases**
  - Monitor active Attempts and quickly spot stuck or failing work.
  - Scan project health across boards to find overloaded or risky projects.
  - Triage review items, failures, and long‑running Attempts from a single inbox.
  - Verify that agents and GitHub integration are configured and healthy.
- **Who uses it**
  - Individual developers checking on their Attempts and review queue.
  - Tech leads / EMs keeping an eye on delivery risk and throughput.
  - Operators verifying that the local server, agents, and GitHub are behaving.
- **How it relates to the rest of KanbanAI**
  - KPIs and **Project Health** roll up card and Attempt metrics from project boards.
  - **Live Agent Activity**, **Recent Attempt History**, and **Inbox** are driven by the same `DashboardOverview` API that powers attempt lists and board updates.
  - **Agents & System** surfaces the same agent registry and GitHub connection state used by the Agents page and Settings.

## Accessing Mission Control

- From the sidebar, click **Dashboard** (labelled **Mission Control** in the page header).
- Route: `/dashboard`.
- API surfaces:
  - `GET /api/v1/dashboard` – initial snapshot, returning a `DashboardOverview`.
  - `GET /api/v1/ws/dashboard` – WebSocket channel that streams `dashboard_overview` messages for the default time range.

## Layout and panel ordering

- The dashboard wraps KPI cards and all panels in a responsive container with `px-4 py-4` on small screens, growing to `px-8 py-6` at desktop widths so content stays centered and readable.
- Below the KPI row, Mission Control uses a two‑column grid from the `xl` breakpoint (`xl:grid-cols-2` with `gap-6`):
  - **Row 1**: **Live Agent Activity** and **Inbox**.
  - **Row 2**: **Project Health** and **Agents & System**.
  - **Row 3**: **Recent Attempt History** spanning both columns (`xl:col-span-2`) so the list can stretch horizontally.
- On smaller screens, panels stack vertically in this order:
  1. KPI cards
  2. Live Agent Activity
  3. Inbox
  4. Project Health
  5. Agents & System
  6. Recent Attempt History

This order keeps live activity and actionable items near the top on both mobile and desktop.

## Time range behavior

Mission Control is scoped by a global time range selector; most widgets respect this range, while a few panels intentionally show live, time‑range‑agnostic data.

### Selector and presets

- The selector beside the primary actions supports these presets:
  - **Last 24 hours** (`last_24h`)
  - **Last 7 days** (`last_7d`) – default (`DEFAULT_DASHBOARD_TIME_RANGE_PRESET`)
  - **Last 30 days** (`last_30d`)
- Changing the preset:
  - Refetches the snapshot via `GET /api/v1/dashboard?timeRangePreset=<preset>`.
  - Re-renders:
    - KPI cards.
    - **Recent Attempt History**.
    - **Inbox**.
    - **Project Health**.
    - **Agents & System**.
- The chosen preset is stored in browser session storage under `dashboard.timeRangePreset`, so navigation away and back (or soft reloads) keep your last range for that session.

### Widgets that respect the time range

The following panels use the selected time range (or a custom range) when computing their data:

- **KPI cards** – “Attempts in range”, “Success rate”, “Items to review”, and “Active projects” all derive from the window described by `DashboardOverview.timeRange`.
- **Recent Attempt History** – shows recently completed or stopped Attempts whose activity falls inside the selected range, ordered by recency.
- **Inbox** – “Review”, “Failed”, and “Stuck” buckets are derived from attempt activity within the same window; the payload is capped to the most recent items.
- **Project Health** – per‑project Attempt counts, failure counts, failure rates, and open card counts are all scoped to the current range.
- **Agents & System** – per‑agent “attempts in range”, success rates, and “last activity” timestamps use the selected window.

### Widgets that are effectively live

- **Active attempts (KPI card)** and the **Active attempts** list in the **Live Agent Activity** panel always represent the current queue:
  - They include Attempts whose status is `queued`, `running`, or `stopping` regardless of the historical preset.
  - The time range label is still shown for context, but the list itself is about “right now”.

### Live vs. fixed updates

- For the default preset (**Last 7 days**):
  - `useDashboardOverview` polls the HTTP endpoint every 15 seconds.
  - `useDashboardStream` opens `/api/v1/ws/dashboard` and applies any `dashboard_overview` messages directly to the default-range cache.
- For non‑default presets:
  - Only HTTP polling is used; WebSocket messages do not overwrite the non‑default range caches.
- Known limits and edge cases:
  - The data model and API support additional presets (`last_90d`, `all_time`) and ISO `from`/`to` ranges, but the Mission Control UI only exposes the three presets above.
  - Recent Attempt History is limited to the most recent slice of events; you may not see older Attempts even with a long range if there has been a lot of recent activity.
  - The inbox payload is truncated to a bounded list (most recent items) and exposes counts via metadata rather than returning every actionable Attempt.

## KPI cards

Mission Control shows a row of KPI cards derived from `DashboardOverview.metrics` and convenience aggregates:

- **Active attempts**
  - Count of Attempts currently `queued`, `running`, or `stopping` across all projects.
  - Represents live, in‑flight work rather than a historical snapshot.
- **Attempts in range**
  - Attempts whose `createdAt` falls within the current time window.
  - Helper text reflects the active preset (for example, “Within selected period” or “Last 7 days”).
- **Success rate**
  - Percentage of Attempts in the current range that succeeded.
  - Computed from `DashboardOverview.successRateInRange` / `DashboardMetrics.successRateInRange`.
- **Items to review**
  - Count of inbox review items that still require human verification.
  - Mirrors `DashboardInbox.review` plus any `meta.totalReview` count provided by the service.
- **Active projects**
  - Number of boards with any Attempt activity in the selected range.
  - Derived from `DashboardOverview.projectsWithActivityInRange` / `DashboardMetrics.projectsWithActivity`.

Skeleton placeholders run while KPIs are loading; a compact error banner appears if the KPI fetch fails, and an empty state explains what you’ll see once agents begin running Attempts in the selected range.

## Live Agent Activity

The Live Agent Activity card surfaces what agents are doing right now and what they’ve done recently.

- **Active attempts**
  - Lists in‑flight Attempts with:
    - Status badges.
    - Card title/ticket key.
    - Project name.
    - Agent label.
    - Relative “Updated …” timestamp.
    - Links back to the board.
  - Filters:
    - Filter by agent, Attempt status (`queued`, `running`, `stopping`), and project.
    - A “Clear filters” action and a small badge show how many filters are active.
    - Filters persist while the component is mounted, so you can keep a narrowed view as new events stream in.
  - Keyboard and mouse:
    - Click a row or press Enter/Space to open `/attempts/:attemptId` (Attempt detail).
  - Empty state:
    - When there are no active Attempts, the panel shows “No active attempts right now.” regardless of the chosen historical range.
- **Recent activity**
  - Compact feed of recently completed or stopped Attempts scoped to the selected time range.
  - Each row shows:
    - Status badge.
    - Card title/ticket key and project name.
    - Agent label.
    - Relative “Finished …” timestamp.
  - Dedicated **View attempt** and **View board** links jump into deeper views without losing your place on the dashboard.
- **Error handling**
  - When the underlying query fails and there is no cached data, the card shows a small retryable error banner.
  - WebSocket disruptions (errors/reconnects) are reflected via a short note (“Live updates temporarily unavailable. Showing latest known data.”) while the UI continues to show the most recent snapshot.

Use this panel to monitor live work across projects, find long‑running Attempts, and jump straight into details when something looks suspicious.

## Inbox

The Inbox panel surfaces actionable items from the shared `DashboardInbox` payload:

- **Buckets**
  - **Review** – succeeded Attempts that still require human verification (for example, PR open or card not in a Done column).
  - **Failed** – Attempts that ended in failure without a later resolved success; each item carries an error summary when available.
  - **Stuck** – queued or running Attempts that exceeded backend thresholds (roughly 10 minutes queued, 30 minutes running).
- **Sorting and layout**
  - Items are ordered by `lastUpdatedAt` so the most urgent work appears first.
  - Each row shows card title/ticket key, project name, agent label (or agent ID fallback), relative last activity, and an Attempt status badge.
  - Card titles link to `/projects/:projectId?cardId=:cardId`, opening the board with the inspector focused on that card.
- **Filtering and refresh**
  - Tabs at the top toggle between **All**, **Review**, **Failed**, and **Stuck**, displaying counts for each bucket.
  - The selected tab is stored in session storage so you stay focused on one bucket as you navigate away and back.
  - A refresh button beside the tabs triggers a manual reload.
- **Interactions**
  - Clicking a row (or pressing Enter/Space) opens `/attempts/:attemptId`.
  - Inline icons let you:
    - Open the Attempt detail page.
    - Open the PR in a new tab when `prUrl` is available.
    - Retry failed items directly from the panel, which re‑queues the agent and refreshes the Inbox.
- **States**
  - Skeletons render for initial load.
  - A compact error banner appears when the dashboard fetch fails.
  - Empty states explain that items will appear as agents start running Attempts that need review or intervention.

## Project Health

Project Health summarizes board workload and risk for the selected time range.

- **Rows**
  - Each project row shows:
    - Project name.
    - Repository slug/path (when known).
    - Total cards and open cards.
    - Column breakdowns (Backlog, In progress, Review, Done).
    - Active Attempts and Attempt/failure counts in the current range.
- **Sorting and highlighting**
  - A **Sort by** control lets you order rows by:
    - Open cards (descending).
    - Failed Attempts in range (descending).
  - Badge indicators highlight:
    - **High Activity** – elevated open card or Attempt volume.
    - **High Failure Rate** – failure rates and volumes above heuristic thresholds.
- **Navigation and states**
  - Clicking a row (or using Enter/Space) jumps directly to that board.
  - Empty state encourages creating a project when no boards are present.
  - An inline retryable error banner appears when the project snapshot fetch fails.
- **Limits**
  - The snapshot currently includes only a bounded number of projects (latest boards first). In large workspaces, older or low‑activity boards may not appear even though they still exist.

Use this panel to spot overloaded projects, high failure rates, or boards with too much open work in the selected window.

## Agents & System

This panel blends system readiness, GitHub integration status, and per‑agent statistics for the selected time range.

- **System readiness**
  - Shows an overall badge describing whether GitHub and agents are configured and healthy.
  - Provides quick links to **View agents** and **Integration settings** so you can act without leaving Mission Control.
- **GitHub integration**
  - Reports whether the GitHub OAuth app is connected, disconnected, erroring, or unknown.
  - Highlights the connected account when available.
  - Shows either **Manage GitHub** or **Connect GitHub** depending on state.
  - Errors and loading states display inline guidance plus a retry link to refresh status.
- **Agent fleet**
  - Summarizes:
    - How many agents are registered.
    - How many handled Attempts in the current range.
    - Success rate and last activity per agent.
  - Up to a bounded set of agents are listed, ordered by recent activity; idle agents in the selected range appear with muted styling but stay visible for comparison.
- **Error handling**
  - GitHub or agent fetch failures render contextual banners with retry buttons.
  - Empty states remind you to register agents or wait for Attempts to appear in the selected timeframe.

## Version indicator

- A small inline indicator beside the Mission Control title:
  - Shows the current server version (`vX.Y.Z`) when `/api/v1/version` resolves cleanly.
  - Shows `Version unavailable` or `Checking version…` while the UI polls.
  - When `updateAvailable: true` is returned, the indicator displays an “Update available — restart to apply” badge so you know to restart KanbanAI for the latest release.

## Visual examples

Mission Control is best understood with a few concrete views:

- **Full dashboard overview**
  - Example image: `docs/assets/mission-control/mission-control-overview.png` – Mission Control with KPI cards, Live Agent Activity, Inbox, Project Health, Agents & System, and Recent Attempt History visible.
- **Per‑panel focus**
  - KPIs: `docs/assets/mission-control/mission-control-kpis.png`.
  - Live Agent Activity: `docs/assets/mission-control/mission-control-live-activity.png`.
  - Inbox: `docs/assets/mission-control/mission-control-inbox.png`.
  - Project Health: `docs/assets/mission-control/mission-control-project-health.png`.
  - Agents & System: `docs/assets/mission-control/mission-control-agents-system.png`.
- **Time range interaction**
  - Short GIF or video (optional): `docs/assets/mission-control/mission-control-time-range.gif` demonstrating switching between presets and watching KPIs and panels update.

If these image files are not present in your clone yet, capture them from a running local environment (`bun run dev`, then open `/dashboard`) and save them under `docs/assets/mission-control/` with the filenames above so the docs render inline screenshots.

## For contributors

This section is for contributors who want to extend or debug the Mission Control experience.

### Code locations

- **Shared types**
  - `shared/src/types/dashboard.ts` – source of `DashboardTimeRange`, `DashboardOverview`, `DashboardMetrics`, inbox types, project snapshots, and per‑agent stats used by both server and client.
- **Core service**
  - `core/src/dashboard/service.ts` – `getDashboardOverview(timeRange?: DashboardTimeRange)` aggregates KPIs, active Attempts, recent Attempt history, inbox items, project snapshots, and agent stats from the database.
  - `core/src/dashboard/time-range.ts` – normalizes presets and custom ranges into canonical `timeRange` values and concrete `from`/`to` bounds.
- **Server / API**
  - `server/src/dashboard/routes.ts` – Hono router for `GET /api/v1/dashboard`; parses `timeRangePreset`, `from`/`to`, or `range` aliases and calls `getDashboardOverview`.
  - `server/src/dashboard/listeners.ts` – subscribes to project/card/attempt events and coalesces `dashboard_overview` broadcasts over WebSockets with a short delay to avoid thrashing.
  - `server/src/ws/dashboard-handlers.ts` – `/api/v1/ws/dashboard` handlers; on connect, sends a `hello` message then the latest `DashboardOverview`, and keeps the socket read‑only.
- **Client / UI**
  - `client/src/api/dashboard.ts` – thin REST wrapper around `GET /api/v1/dashboard`.
  - `client/src/hooks/dashboard.ts` – `useDashboardOverview` (React Query snapshot fetching) and `useDashboardStream` (WebSocket streaming for the default preset).
  - `client/src/pages/DashboardPage.tsx` – top‑level Mission Control page that wires the time range selector, KPI cards, and all panels together.
  - `client/src/pages/dashboard/*.tsx` – panel components:
    - `LiveAgentActivityPanel.tsx` and `ActiveAttemptsList.tsx`.
    - `RecentAttemptHistoryPanel.tsx` and `RecentActivityList.tsx`.
    - `InboxPanel.tsx`.
    - `ProjectHealthPanel.tsx` and `projectHealthHelpers.ts`.
    - `AgentsSystemStatusPanel.tsx`.

### DashboardOverview API at a glance

- **HTTP**
  - Endpoint: `GET /api/v1/dashboard`.
  - Query parameters:
    - `timeRangePreset?: "last_24h" | "last_7d" | "last_30d" | "last_90d" | "all_time"`.
    - `from?: string`, `to?: string` – ISO 8601 UTC bounds; both must be present when `timeRangePreset` is omitted.
    - `range?: "24h" | "7d" | "30d" | "90d" | "all"` – friendly alias mapped to presets; unknown values return HTTP 400.
  - Semantics:
    - Valid `from`/`to` win over presets; invalid or partial custom bounds result in HTTP 400, so clients should only send well‑formed ISO ranges or rely on presets/range aliases.
    - `"all_time"` is treated as unbounded on the lower side and bounded at “now” on the upper side.
    - The resolved `DashboardTimeRange` is echoed back as `overview.timeRange` and used consistently by all range‑scoped metrics.
- **WebSocket**
  - Endpoint: `/api/v1/ws/dashboard`.
  - Messages:
    - `{"type":"hello","payload":{"serverTime":"<ISO>"}}` on connect.
    - `{"type":"dashboard_overview","payload": <DashboardOverview>}` on connect and whenever listeners schedule a broadcast.
  - The client only streams the default preset and uses HTTP polling for other presets to keep cache behavior simple.
- **Payload structure (high level)**
  - `timeRange` – canonical window applied to all range‑scoped metrics.
  - `generatedAt` / `updatedAt?` – timestamp used for the “Updated …” label.
  - `metrics` – KPI‑friendly wrapper around the `byKey` metric registry plus convenience fields such as `activeAttempts`, `attemptsInRange`, `successRateInRange`, `reviewItemsCount`, and `projectsWithActivity`.
  - `activeAttempts` – live queue of `queued` / `running` / `stopping` Attempts across projects (not filtered by time range).
  - `recentAttemptActivity` – bounded list of recently completed/stopped Attempts ordered by recency and scoped to `timeRange`.
  - `inboxItems` – grouped `review` / `failed` / `stuck` items; truncated to the most recent items with counts exposed via `meta`.
  - `projectSnapshots` – snapshot of recent projects with per‑board card counts, activity/failure metrics, and derived health flags.
  - `agentStats` – per‑agent Attempt counts, success rates, and last‑activity timestamps for the selected range.

### Performance and caching considerations

- `getDashboardOverview` performs a small number of aggregate queries over the attempts, cards, columns, and boards tables. It is designed to be called frequently but benefits from:
  - Using presets or reasonably bounded custom ranges instead of extremely wide windows in very high‑volume installations.
  - Avoiding custom ranges that advance in tiny increments when you do not need that precision.
- WebSocket broadcasts are coalesced:
  - `registerDashboardListeners` batches project/card/attempt events into a single `dashboard_overview` update using a short timeout so heavy activity does not flood clients.
  - The client’s `useDashboardStream` backs off reconnection attempts exponentially when the socket is unhealthy.
- On the client:
  - `useDashboardOverview` caches snapshots per time range (`dashboard.overview()` for the default, `dashboard.overview(<preset>)` for others) and refetches them every 15 seconds in the background.
  - WebSocket messages update only the default‑range cache entry; non‑default presets rely purely on HTTP polling.

### Tests

Mission Control is covered by tests in all three workspaces. Commands below assume you have already run `bun install` from the repository root.

- **All workspaces**
  - Run the full suite (core, server, client):  
    - `bun run test`
- **Core service**
  - Key tests: `core/tests/dashboard.service.test.ts`.
  - Run only the dashboard service tests:  
    - `cd core && bun run test -- --runTestsByPath core/tests/dashboard.service.test.ts`
- **Server / API**
  - Key tests:
    - `server/test/dashboard.routes.test.ts` – HTTP routing, parameter parsing, and error codes for `/api/v1/dashboard`.
    - `server/test/dashboard.ws.test.ts` – WebSocket handshake, hello message, and `dashboard_overview` broadcasting.
  - Run only the dashboard server tests:  
    - `cd server && bun run test -- --runTestsByPath server/test/dashboard.routes.test.ts server/test/dashboard.ws.test.ts`
- **Client / UI**
  - Key tests:
    - `client/test/MissionControlDashboardPage.test.tsx` – overall layout, KPI labels, and time range selector behavior.
    - `client/test/LiveAgentActivityPanel.test.tsx` – live activity filtering and empty/error states.
    - `client/test/ProjectHealthPanel.test.tsx` and `client/test/projectHealthHelpers.test.ts` – project health metrics and sorting.
    - `client/test/RecentAttemptHistoryPanel.test.tsx` – recent history rendering and empty/error states.
    - `client/test/DashboardInboxPanel.test.tsx` and `client/test/DashboardAgentsPanel.test.tsx` – inbox and Agents & System panels.
    - `client/test/dashboardApi.test.ts` – REST wrapper for the DashboardOverview API.
  - Run only the dashboard‑related client tests (example):  
    - `cd client && bun run test -- client/test/MissionControlDashboardPage.test.tsx client/test/LiveAgentActivityPanel.test.tsx client/test/ProjectHealthPanel.test.tsx client/test/RecentAttemptHistoryPanel.test.tsx client/test/DashboardInboxPanel.test.tsx client/test/DashboardAgentsPanel.test.tsx client/test/dashboardApi.test.ts`
- **E2E**
  - There are currently no Playwright/Cypress‑style end‑to‑end tests for Mission Control. When such tests are added, they should be documented here with their exact commands and any required fixtures.

The core dashboard service tests use an in‑memory SQLite database, server tests stub `getDashboardOverview`, and client tests run under jsdom, so no external databases or mock servers are needed to run the Mission Control suite locally.
