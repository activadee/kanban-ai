# Dashboard

Last updated: 2025-12-08

## Purpose

- Provide a single place to monitor:
  - Overall project and card counts.
  - Active and recent Attempts.
  - Per-project workload.
  - System status (GitHub connection and agents).
- The Dashboard is powered by the `getDashboardOverview` service in `core`, surfaced over HTTP and WebSockets.

For a user-facing walkthrough of Mission Control panels and workflows, see the [Mission Control dashboard guide](../guides/dashboard-ui).

## Data model

The Dashboard overview is represented by the shared `DashboardOverview` type in the `shared` workspace. At a high level it includes:

- `timeRange: DashboardTimeRange`  
  - Canonical window that all metrics and counts are scoped to.  
  - Either a preset (`"last_24h" | "last_7d" | "last_30d" | "last_90d" | "all_time"`) or a `from`/`to` ISO 8601 range.
- `generatedAt: string` / `updatedAt?: string`  
  - ISO 8601 timestamp when the snapshot was computed (UI uses this for “Updated …” badges).
- `metrics: DashboardMetrics`  
  - `byKey: Record<string, DashboardMetricSeries>` – canonical metric registry.  
  - Current canonical keys:
    - `projects.total` – total projects/boards.
    - `attempts.active` – active Attempts (`queued`/`running`/`stopping`).
    - `attempts.completed` – Attempts completed within `timeRange`.
    - `cards.open` – cards not in a **Done** column.
  - Strongly-typed headline aggregates:
    - `activeAttempts?` – total active attempts across all projects.
    - `attemptsInRange?` – total attempts whose `createdAt` falls within `timeRange`.
    - `successRateInRange?` – success rate (0–1) for attempts in `timeRange`.
    - `reviewItemsCount?` – number of inbox items that require review.
    - `projectsWithActivity?` – number of projects/boards with any attempt activity in `timeRange`.
  - Each `DashboardMetricSeries` contains:
    - `label`, `unit?`, `points: DashboardMetricPoint[]`, `total?`, `trend?`, and `meta?`.
- `activeAttempts: ActiveAttemptSummary[]`  
  - Recent in-flight Attempts with:
    - Attempt ID, project id/name, card id/title/ticket key, `agentId`, `status: AttemptStatus`, `startedAt`, `updatedAt`, plus optional `elapsedSeconds` and `priority`.
- `recentAttemptActivity: AttemptActivityItem[]`  
  - Recently completed/changed Attempts with:
    - Attempt ID, project id/name, card id/title/ticket key, `agentId`, `status`, `occurredAt`, optional `durationSeconds`, `errorSummary`, and `triggerSource`.
    - When present, `durationSeconds` is computed from the best available start (e.g. `startedAt`, falling back to `createdAt`) and the finish timestamp so UIs can show how long the attempt ran.
- `inboxItems: DashboardInbox`  
  - Actionable items grouped into `review`, `failed`, and `stuck` lists.  
  - Each item is a discriminated `InboxItem` union (`type: "review" | "failed" | "stuck"`, with a matching `kind` field).  
  - Common fields per item include:
    - `id`, `attemptId?`, `projectId?`/`projectName?`, `cardId?`/`cardTitle?`, `ticketKey?`, `agentId?`/`agentName?`, `status?`, `cardStatus?`, `createdAt`, `updatedAt?`, `finishedAt?`, `lastUpdatedAt?`, `prUrl?`, `errorSummary?`, and `meta?`.  
  - `review` items represent succeeded attempts that still require human review (for example, PR open or card not in a Done column).  
  - `failed` items represent failed (or stopped) attempts that have not yet been resolved or superseded by a later success and include a short `errorSummary`.  
  - `stuck` items represent long-running or queued/stopping attempts beyond configured thresholds and include `stuckForSeconds`.  
  - The backend scans recent attempts within the selected dashboard `timeRange`, derives actionable inbox candidates, then returns at most 25 of the most recent items across all kinds (ordered by `lastUpdatedAt` descending). The `meta` counts on `DashboardInbox` reflect the number of items in this truncated snapshot rather than the total number of actionable attempts in storage.
- `projectSnapshots: ProjectSnapshot[]`  
  - Per-project snapshot with:
    - Identity and metadata: `projectId`/`id`, `name`, health `status`, repository slug/path, `createdAt`.
    - Card counts:
      - `totalCards` (all cards on the board).
      - `openCards` (cards not in a "Done" column).
      - `columnCardCounts` with canonical buckets `{ backlog, inProgress, review, done }` used by the dashboard for sorting and filtering.
        - The aggregation layer maps provider-specific column titles into these buckets using simple heuristics (e.g. "Todo" → backlog, "In Progress" → inProgress, "Review" → review, "Done" → done).
        - Unknown or custom titles are currently treated as `inProgress` so that open work is not silently dropped from activity metrics; this behavior may be refined in future iterations.
    - Attempt and failure metrics:
      - `activeAttempts` / `activeAttemptsCount` (currently active attempts).
      - `attemptsInRange`, `failedAttemptsInRange`, and `failureRateInRange` scoped to the same `timeRange` as the parent overview.
    - Derived health metrics:
      - Legacy fields such as `healthScore`, `errorRate`, `throughput`, `p95LatencyMs`, `recentFailuresCount`.
      - A structured `health` block with `activityScore`, `failureRateInRange`, `isHighActivity`, `isAtRisk`, and optional `notes` for machine-generated explanations.
- `agentStats: AgentStatsSummary[]`  
  - Per-agent stats over `timeRange`:
    - Identity: `agentId`, `agentName`, `status`.
    - Volume and outcomes:
      - `attemptsStarted` / `attemptsInRange` – attempts whose `createdAt` falls within the selected `timeRange`.
      - `attemptsSucceeded`, `attemptsFailed`.
      - `successRateInRange` – success rate as a fraction between `0` and `1` (`null` when there are no attempts in range), with `successRate` kept as a legacy alias.
    - Activity:
      - `lastActivityAt` – most recent attempt for the agent within `timeRange` (or `null` when there is no activity in range).
      - `hasActivityInRange` – convenience flag derived from `attemptsInRange > 0`.
      - `currentActiveAttempts?` – number of currently active attempts attributed to the agent.
    - Optional extras: `avgLatencyMs?`, `lastActiveAt?` (unbounded activity timestamp), and `meta` for future extensions.
- `attemptsInRange?: number`  
  - Convenience aggregate for the total number of attempts in the selected `timeRange`.
- `successRateInRange?: number`  
  - Convenience aggregate for the success rate (0–1) of attempts in the selected `timeRange` (`0` when there are no attempts).
- `projectsWithActivityInRange?: number`  
  - Convenience aggregate for how many distinct projects/boards have any attempt activity in the selected `timeRange`.
- `meta?: DashboardOverviewMeta`  
  - Optional payload version, available time-range presets, feature flags, and an `extra` extension bag.

Forward-compatibility:

- New metrics should be introduced under `metrics.byKey` first, with optional strongly-typed helpers.
- New inbox item variants can be added by extending the `InboxItem` union.
- New project/agent fields should be added as optional properties to avoid breaking existing consumers.

## API and streaming

- HTTP:
  - `GET /api/v1/dashboard` – returns the current `DashboardOverview` snapshot.
    - Canonical time range parameters:
      - Preset:  
        - `GET /api/v1/dashboard?timeRangePreset=last_24h`  
        - `GET /api/v1/dashboard?timeRangePreset=last_7d`  
        - `GET /api/v1/dashboard?timeRangePreset=last_30d`  
        - `GET /api/v1/dashboard?timeRangePreset=last_90d`  
        - `GET /api/v1/dashboard?timeRangePreset=all_time`
      - Custom range (ISO 8601, inclusive `from`, exclusive `to`):  
        - `GET /api/v1/dashboard?from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z`
      - Convenience alias (mapped to presets, additive to the canonical API):  
        - `GET /api/v1/dashboard?range=24h` → `timeRangePreset=last_24h`  
        - `GET /api/v1/dashboard?range=7d` → `timeRangePreset=last_7d`  
        - `GET /api/v1/dashboard?range=30d` → `timeRangePreset=last_30d`  
        - `GET /api/v1/dashboard?range=90d` → `timeRangePreset=last_90d`  
        - `GET /api/v1/dashboard?range=all` → `timeRangePreset=all_time`
    - Default when no range is provided:
      - When callers omit both `timeRangePreset` and `from`/`to`, the server uses
        `DEFAULT_DASHBOARD_TIME_RANGE_PRESET` from `shared` (currently `last_7d`)
        as the default window. Client code should import and reuse this constant
        instead of hard-coding the preset string.
    - Precedence rules:
      - If `from` or `to` is provided, the handler requires both to be valid ISO 8601 values and ignores any `timeRangePreset` or `range`.
      - Otherwise, a valid `timeRangePreset` is used when present and the `range` alias is ignored.
      - When only `range` is present, it must be one of `24h | 7d | 30d | 90d | all`; unknown values return HTTP 400.
    - All query parameters are normalized into `DashboardTimeRange`, which is echoed back as `DashboardOverview.timeRange`. The response also includes `meta.availableTimeRangePresets` and a payload `meta.version` string for forwards-compatible evolution.
- WebSocket:
  - The Dashboard channel uses a fixed `dashboard` ID.
  - On connect:
    - Sends a `hello` envelope: `{"type":"hello","payload":{"serverTime": "<ISO 8601>"}}`.
    - Then sends the latest overview: `{"type":"dashboard_overview","payload": <DashboardOverview>}`.
    - The HTTP and WebSocket surfaces share the same `DashboardOverview` shape, including `timeRange` and `meta` (e.g. `meta.version`, `meta.availableTimeRangePresets`).
  - Subsequent `dashboard_overview` updates are pushed when relevant events occur (projects, cards, attempts), using the same time-range semantics as the HTTP endpoint.
  - Client behaviour:
    - The current Mission Control UI opens a WebSocket stream for the default
      preset only (`DEFAULT_DASHBOARD_TIME_RANGE_PRESET`) and relies on the
      periodic HTTP refresh for non-default ranges to keep cache semantics
      simple. If future iterations introduce streaming for additional presets,
      the cache key strategy in the client should be revisited alongside this
      documentation.
- Client hooks:
  - `useDashboardOverview` – fetches the snapshot over HTTP and caches it using React Query.
  - `useDashboardStream` – opens a WebSocket connection to receive live updates.

## UI panels

- **Metric cards**
  - Show high-level KPIs for the current dashboard snapshot:
    - Active attempts currently in progress.
    - Attempts in the selected time range.
    - Success rate for attempts in the selected time range.
    - Items to review from the inbox.
    - Active projects with any attempt activity in the selected range (when available).
- **Live Agent Activity**
  - Renders the live `Active attempts` list (status badges, project/agent metadata, relative timestamps, board links) for the chosen time range. Filters and keyboard access remain the same, and the helper text calls out when live updates pause or the stream reconnects.
- **Recent Attempt History**
  - New card that surfaces recently completed/stopped attempts scoped to the same time range. Each row exposes the status badge, ticket title/key, project/board link, agent (or fallback), formatted duration, absolute/relative timestamps, and a quick “View attempt” link. Keyboard/mouse activation opens `/attempts/:attemptId`, and a show more/show less footer lets you page through larger histories. Skeletons, retryable error banners, and empty-state messaging match the other dashboard cards for consistent UX.
- **Inbox**
  - Renders actionable `review`, `failed`, and `stuck` buckets derived from `DashboardInbox`. Each item shows card/ticket context, project/agent metadata, and the most recent timestamp (`lastUpdatedAt`/`finishedAt`/`createdAt`), with groups sorted by recency so urgent work surfaces first.
  - Tabs for **All**, **Review**, **Failed**, or **Stuck** items live above the list, display counts for each kind, and persist the selected filter in session storage to keep the same bucket focused while navigating the dashboard.
  - A refresh button beside the tabs triggers a manual reload; the panel renders skeleton placeholders during the initial load and surfaces a retryable error banner if the dashboard query fails.
  - Each row is keyboard accessible and exposes inline actions: clicking the row or the attempt icon opens `/attempts/:attemptId`, a PR icon opens `prUrl` (if present) in a new tab, and failed items include a retry button that re-queues the agent and refreshes the inbox.
- **Project Health**
-  - Replaces the legacy project snapshot card with rows that surface each project’s repository, total cards, open cards, active attempts, and column breakdowns (backlog, in-progress, review, done) for the selected range.
-  - Includes a **Sort by** control so you can order projects by open cards or failed attempts in range, and each row can be activated (click/keyboard) to jump straight to the board to keep investigating.
-  - Rows surface activity/failure badges derived from the project health metadata, plus attempt/failure counts and tooltips that explain when a project is marked “High Activity” or “High Failure Rate.”
- **Agents & System**
  - Successor to the System status card. GitHub blocks display connection health and the authenticated username (or next steps when disconnected). The agent list still reflects the current preset with attempts in range, success rate, and last activity; agents with no recent runs show a muted “inactive in this range” hint so they remain visible even when idle.
