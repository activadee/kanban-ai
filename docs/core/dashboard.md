# Dashboard

Last updated: 2025-12-08

## Purpose

- Provide a single place to monitor:
  - Overall project and card counts.
  - Active and recent Attempts.
  - Per-project workload.
  - System status (GitHub connection and agents).
- The Dashboard is powered by the `getDashboardOverview` service in `core`, surfaced over HTTP and WebSockets.

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
  - Each `DashboardMetricSeries` contains:
    - `label`, `unit?`, `points: DashboardMetricPoint[]`, `total?`, `trend?`, and `meta?`.
- `activeAttempts: ActiveAttemptSummary[]`  
  - Recent in-flight Attempts with:
    - Attempt ID, project id/name, card id/title/ticket key, `agentId`, `status: AttemptStatus`, `startedAt`, `updatedAt`, plus optional `elapsedSeconds` and `priority`.
- `recentAttemptActivity: AttemptActivityItem[]`  
  - Recently completed/changed Attempts with:
    - Attempt ID, project id/name, card id/title/ticket key, `agentId`, `status`, `occurredAt`, optional `durationSeconds`, `errorSummary`, and `triggerSource`.
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
    - Time range selection:
      - `GET /api/v1/dashboard?timeRangePreset=last_24h`
      - `GET /api/v1/dashboard?timeRangePreset=last_7d`
      - `GET /api/v1/dashboard?timeRangePreset=all_time`
      - `GET /api/v1/dashboard?from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z`
    - Query parameters are mapped into `DashboardTimeRange` and echoed back in the response.
- WebSocket:
  - The Dashboard channel uses a fixed `dashboard` ID.
  - On connect, it sends a `hello` message and the latest overview.
  - Subsequent updates are pushed periodically or when related events occur.
- Client hooks:
  - `useDashboardOverview` – fetches the snapshot over HTTP and caches it using React Query.
  - `useDashboardStream` – opens a WebSocket connection to receive live updates.

## UI panels

- **Metric cards**
  - Show high-level counts for projects, active Attempts, Attempts in the selected time range, and open cards.
- **Active Attempts**
  - Lists in-flight Attempts with status badges and links to their boards/cards.
- **Recent activity**
  - Shows recently completed Attempts (success, failure, stopped) with relative timestamps.
- **Project snapshot**
  - Per-project card totals, open card counts, and active Attempts; each entry links to the project board.
- **System status**
  - GitHub:
    - Uses the GitHub auth status API to report whether you are connected and which account is active.
  - Agents:
    - Uses the Agents registry to show how many agents are available and whether any are registered.
    - Renders per-agent stats from `DashboardOverview.agentStats`, including attempts in the selected time range, success rate, and last activity timestamp.
    - Agents with no attempts in the current `timeRange` are still listed and visually marked as inactive in this range so that the UI can highlight inactivity.
