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
  - Either a preset (`"last_24h" | "last_7d" | "last_30d" | "last_90d"`) or a `from`/`to` ISO 8601 range.
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
  - Each item is a discriminated `InboxItem` union (`type: "review" | "failed" | "stuck"`).
- `projectSnapshots: ProjectSnapshot[]`  
  - Per-project snapshot with:
    - `projectId`/`id`, name, health `status`, repository slug/path, createdAt, card counts (`totalCards`, `openCards`), attempt counts (`activeAttempts`/`activeAttemptsCount`), and optional health metrics (`healthScore`, `errorRate`, `throughput`, `p95LatencyMs`, `recentFailuresCount`).
- `agentStats: AgentStatsSummary[]`  
  - Per-agent stats over `timeRange`:
    - `agentId`, `agentName`, `status`, `attemptsStarted`, `attemptsSucceeded`, `attemptsFailed`, plus optional `successRate`, `avgLatencyMs`, `currentActiveAttempts`, `lastActiveAt`, and `meta`.
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
  - Show high-level counts for projects, active Attempts, Attempts over the last 24h, and open cards.
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
