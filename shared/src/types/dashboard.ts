import type {AttemptStatus, AgentKey} from './runner'
import type {ProjectId} from './project'

/**
 * Preset time ranges supported by the Mission Control dashboard.
 *
 * These presets drive both backend aggregation windows and default chart
 * bucket sizing. They are intended to be stable over time; new presets can
 * be appended without breaking existing clients.
 */
export type DashboardTimeRangePreset =
    | 'last_24h'
    | 'last_7d'
    | 'last_30d'
    | 'last_90d'
    /**
     * Special preset representing the full history of available data.
     *
     * Implementations SHOULD treat this as unbounded on the lower side while
     * keeping an upper bound at "now" when resolving concrete query windows.
     */
    | 'all_time'

/**
 * Default dashboard time-range preset used when callers omit explicit
 * time-range parameters.
 *
 * Keep server/router defaults, documentation, and client behaviour aligned
 * with this constant to avoid drift.
 */
export const DEFAULT_DASHBOARD_TIME_RANGE_PRESET: DashboardTimeRangePreset = 'last_7d'

/**
 * Canonical representation of the time window used to compute dashboard
 * metrics and aggregates.
 *
 * Exactly one of:
 * - `preset` – a named range such as `"last_24h"`.
 * - `from` + `to` – a custom inclusive-exclusive UTC interval in ISO 8601.
 *
 * The backend should always normalize incoming query parameters into this
 * shape and propagate it through the stack so that both API and UI can
 * clearly describe what period the metrics refer to.
 */
export interface DashboardTimeRange {
    /**
     * Named preset applied to this overview, when applicable.
     *
     * When set, `from` and `to` MAY be populated as the concrete window but
     * `preset` remains the canonical description for clients.
     */
    preset?: DashboardTimeRangePreset
    /**
     * Start of the time window in UTC ISO 8601 (inclusive).
     *
     * Present when a custom range is used, or when the backend chooses to
     * expose the resolved bounds for a preset.
     */
    from?: string
    /**
     * End of the time window in UTC ISO 8601 (exclusive).
     *
     * Present when a custom range is used, or when the backend chooses to
     * expose the resolved bounds for a preset.
     */
    to?: string
}

/**
 * Query parameter contract for the dashboard overview endpoint.
 *
 * The HTTP handler should:
 * - Accept either `timeRangePreset` OR `from`+`to`.
 * - Map those query parameters into a `DashboardTimeRange` instance.
 */
export interface DashboardTimeRangeQuery {
    /**
     * Named preset such as `"last_24h"`.
     *
     * Mutually exclusive with `from`/`to` – if present, the backend ignores
     * any provided `from`/`to` values and resolves the preset instead.
     */
    timeRangePreset?: DashboardTimeRangePreset
    /**
     * Start of a custom time range in UTC ISO 8601 (inclusive).
     *
     * Must be provided together with `to` when `timeRangePreset` is omitted.
     */
    from?: string
    /**
     * End of a custom time range in UTC ISO 8601 (exclusive).
     *
     * Must be provided together with `from` when `timeRangePreset` is omitted.
     */
    to?: string
}

/**
 * A single bucketed metric value for a given timestamp.
 *
 * Each point represents an aggregate over the interval
 * `[timestamp, timestamp + bucketSizeSeconds)`.
 */
export interface DashboardMetricPoint {
    /**
     * Start of the bucket in UTC ISO 8601.
     */
    timestamp: string
    /**
     * Aggregated value for this bucket.
     *
     * For counts, this is usually an integer; for rates, this is a value
     * normalized to the bucket duration (e.g. events per second).
     */
    value: number
    /**
     * Duration of the bucket in seconds.
     *
     * When omitted, clients may infer it from adjacent points or treat the
     * series as unbucketed.
     */
    bucketSizeSeconds?: number
}

/**
 * Qualitative trend indicator derived from the metric series within the
 * selected time range.
 */
export type DashboardMetricTrend = 'up' | 'down' | 'flat'

/**
 * Time-series metric used for dashboard charts and aggregates.
 *
 * All values are scoped to a single `DashboardTimeRange` associated with the
 * parent `DashboardOverview`.
 */
export interface DashboardMetricSeries {
    /**
     * Human-friendly label for this metric, suitable for chart legends.
     */
    label: string
    /**
     * Optional unit label (e.g. `"count"`, `"ms"`, `"percentage"`).
     *
     * This is used purely for display and does not affect semantics.
     */
    unit?: string
    /**
     * Bucketed time-series points for this metric.
     *
     * The array may be empty when no events were observed in the time range.
     */
    points: DashboardMetricPoint[]
    /**
     * Aggregate value for the entire time range (e.g. total attempts).
     *
     * When omitted, clients should compute their own aggregate from `points`
     * if needed.
     */
    total?: number
    /**
     * Qualitative trend over the selected time range.
     *
     * This is intentionally coarse to remain stable across implementations.
     */
    trend?: DashboardMetricTrend
    /**
     * Extension point for metric-specific metadata.
     *
     * Use this to attach labels, breakdowns, or additional aggregates without
     * breaking existing clients; consumers should treat unknown keys as
     * opaque.
     */
    meta?: Record<string, unknown>
}

/**
 * Canonical metric keys used by the current dashboard implementation.
 *
 * These keys are exposed under `DashboardMetrics.byKey` and may be used by
 * clients to look up specific headline metrics in a forwards-compatible way.
 */
export const DASHBOARD_METRIC_KEYS = {
    /**
     * Total number of projects/boards.
     */
    projectsTotal: 'projects.total',
    /**
     * Count of active attempts across all projects.
     */
    activeAttempts: 'attempts.active',
    /**
     * Count of attempts completed within the selected time range.
     */
    attemptsCompleted: 'attempts.completed',
    /**
     * Count of cards that are not in a "Done" column.
     */
    openCards: 'cards.open',
} as const

/**
 * Union of known dashboard metric keys plus a generic string for future
 * extension.
 *
 * New keys should be added by extending `DASHBOARD_METRIC_KEYS`.
 */
export type DashboardMetricKey = (typeof DASHBOARD_METRIC_KEYS)[keyof typeof DASHBOARD_METRIC_KEYS] | string

/**
 * Collection of metrics displayed on the Mission Control dashboard.
 *
 * This type balances:
 * - Strongly-typed, well-known metrics used heavily by the UI.
 * - A flexible `byKey` map that allows new metrics to be introduced without
 *   changing the type definition.
 *
 * Forward-compatibility:
 * - New strongly-typed fields should be added as optional.
 * - New metric keys should be added only under `byKey`.
 */
export interface DashboardMetrics {
    /**
     * Canonical registry of metric series keyed by stable identifiers.
     *
     * Keys should be lower_snake_case or dot-separated (e.g.
     * `"attempts.started"`) and remain stable once introduced.
     */
    byKey: Record<string, DashboardMetricSeries>
    /**
     * Convenience aggregate for the number of currently active attempts.
     *
     * Implementations SHOULD keep this consistent with the
     * `"attempts.active"` metric exposed via `byKey` when present.
     */
    activeAttempts?: number
    /**
     * Convenience aggregate for the total number of attempts that fall within
     * the selected `DashboardOverview.timeRange`.
     *
     * This SHOULD mirror `DashboardOverview.attemptsInRange` when populated.
     */
    attemptsInRange?: number
    /**
     * Convenience aggregate for the success rate of attempts within the
     * selected `DashboardOverview.timeRange`.
     *
     * Expressed as a fraction between `0` and `1` unless otherwise
     * documented; when there are no attempts in the window this should be
     * `0` to avoid `NaN`.
     */
    successRateInRange?: number
    /**
     * Convenience aggregate for the number of inbox items that require
     * review within the selected `DashboardOverview.timeRange`.
     *
     * Implementations SHOULD keep this consistent with the `review` list on
     * `DashboardInbox` and any associated `meta.totalReview` count.
     */
    reviewItemsCount?: number
    /**
     * Convenience aggregate for how many distinct projects/boards have any
     * attempt activity within the selected `DashboardOverview.timeRange`.
     *
     * This SHOULD mirror `DashboardOverview.projectsWithActivityInRange`
     * when populated.
     */
    projectsWithActivity?: number
    /**
     * Convenience handle for the `"attempts.started"` metric when available.
     *
     * Clients SHOULD prefer this field when present, falling back to
     * `byKey['attempts.started']` otherwise.
     */
    attemptsStarted?: DashboardMetricSeries
    /**
     * Convenience handle for the `"attempts.succeeded"` metric when available.
     */
    attemptsSucceeded?: DashboardMetricSeries
    /**
     * Convenience handle for the `"attempts.failed"` metric when available.
     */
    attemptsFailed?: DashboardMetricSeries
    /**
     * Throughput metric (e.g. attempts per minute) over the selected range.
     */
    throughput?: DashboardMetricSeries
    /**
     * Latency metric representing end-to-end attempt latency in milliseconds.
     */
    latencyMs?: DashboardMetricSeries
}

/**
 * Summary of an active attempt currently running or queued.
 *
 * These entries are intended for list views and quick navigation, not for
 * full attempt introspection.
 */
export interface ActiveAttemptSummary {
    /**
     * Unique identifier of the attempt.
     */
    attemptId: string
    /**
     * Associated project identifier, when the attempt is scoped to a project.
     *
     * Attempts created outside of a project MAY use `null`.
     */
    projectId: ProjectId | null
    /**
     * Human-friendly project name, when available.
     */
    projectName: string | null
    /**
     * Associated board/card identifier for quick linking from the UI.
     */
    cardId: string
    /**
     * Card title, when available.
     */
    cardTitle: string | null
    /**
     * External ticket key (e.g. JIRA issue key) when linked.
     */
    ticketKey: string | null
    /**
     * Identifier of the agent executing the attempt.
     *
     * Typically corresponds to an `AgentKey` such as `"CODEX"`.
     */
    agentId: AgentKey | string
    /**
     * Current attempt status.
     *
     * For active attempts this will typically be `"queued"`, `"running"`, or
     * `"stopping"`.
     */
    status: AttemptStatus
    /**
     * UTC ISO 8601 timestamp when the attempt started, if known.
     */
    startedAt: string | null
    /**
     * UTC ISO 8601 timestamp of the latest status update, if known.
     */
    updatedAt: string | null
    /**
     * Elapsed wall-clock time in seconds since `startedAt`.
     *
     * This is a derived convenience value; clients MAY recompute it.
     */
    elapsedSeconds?: number
    /**
     * Relative scheduling priority of the attempt.
     *
     * This is reserved for future use; most current attempts will omit it.
     */
    priority?: 'low' | 'normal' | 'high'
}

/**
 * Backwards-compatible alias for historical naming.
 *
 * Prefer `ActiveAttemptSummary` for new code.
 */
export type DashboardAttemptSummary = ActiveAttemptSummary

/**
 * Activity entry describing a notable state change for an attempt.
 *
 * The dashboard typically shows the most recent items ordered by
 * `occurredAt` descending.
 */
export interface AttemptActivityItem {
    /**
     * Unique identifier of the attempt.
     */
    attemptId: string
    /**
     * Associated project identifier, when the attempt is scoped to a project.
     */
    projectId: ProjectId | null
    /**
     * Human-friendly project name, when available.
     */
    projectName: string | null
    /**
     * Associated board/card identifier for quick linking from the UI.
     */
    cardId: string
    /**
     * Card title, when available.
     */
    cardTitle: string | null
    /**
     * External ticket key (e.g. JIRA issue key) when linked.
     */
    ticketKey: string | null
    /**
     * Identifier of the agent that executed the attempt.
     */
    agentId: AgentKey | string
    /**
     * Outcome status for this activity item.
     *
     * Currently aligned with `AttemptStatus`, but may include additional
     * terminal states in the future (e.g. `"canceled"`).
     */
    status: AttemptStatus
    /**
     * UTC ISO 8601 timestamp when this activity occurred.
     *
     * For completion events this is typically the finished time; for
     * in-progress events this may be the latest update time.
     */
    occurredAt: string
    /**
     * Total duration of the attempt in seconds, when known.
     */
    durationSeconds?: number
    /**
     * Short human-readable summary of the error for failed attempts.
     */
    errorSummary?: string
    /**
     * High-level trigger source for the attempt (API, schedule, manual, etc).
     *
     * Additional string values may be added over time; clients should treat
     * unknown values as opaque.
     */
    triggerSource?: 'api' | 'schedule' | 'manual' | string
}

/**
 * Backwards-compatible alias for historical naming.
 *
 * Prefer `AttemptActivityItem` for new code.
 */
export type DashboardAttemptActivity = AttemptActivityItem

/**
 * Supported inbox item kinds.
 *
 * This union is intentionally closed to keep discrimination simple; new
 * variants can be added by extending the `InboxItem` union.
 */
export type InboxItemType = 'review' | 'failed' | 'stuck'

/**
 * Fields common to all inbox item variants.
 *
 * Inbox items represent actionable entities surfaced to human operators,
 * often derived from attempts but not always 1:1 with them.
 */
export interface InboxItemBase {
    /**
     * Stable identifier for the inbox item itself.
     */
    id: string
    /**
     * Optional kind alias for the inbox item, mirroring the discriminant.
     *
     * This is provided to align with UI/UX terminology where items are
     * grouped by kind (review, failed, stuck).
     */
    kind?: InboxItemType
    /**
     * Associated attempt identifier, when the item maps to a specific attempt.
     */
    attemptId?: string
    /**
     * Associated project identifier, when known.
     */
    projectId?: ProjectId
    /**
     * Human-friendly project name, when available.
     */
    projectName?: string | null
    /**
     * Identifier of the relevant agent, when applicable.
     */
    agentId?: AgentKey | string
    /**
     * Display name for the agent; when omitted, clients SHOULD fall back to
     * `agentId` or a generic label.
     */
    agentName?: string | null
    /**
     * Associated card identifier, when known.
     */
    cardId?: string
    /**
     * Human-friendly card title, when available.
     */
    cardTitle?: string | null
    /**
     * External ticket key or slug (e.g. JIRA issue key), when linked.
     */
    ticketKey?: string | null
    /**
     * Status of the underlying attempt or entity.
     *
     * When derived from attempts this typically mirrors `AttemptStatus`.
     */
    status?: AttemptStatus | string
    /**
     * Display status of the card (for example the column title).
     */
    cardStatus?: string | null
    /**
     * UTC ISO 8601 timestamp when the inbox item was created.
     */
    createdAt: string
    /**
     * UTC ISO 8601 timestamp of the most recent update, when applicable.
     */
    updatedAt?: string
    /**
     * UTC ISO 8601 timestamp when the underlying attempt finished, for
     * terminal states, or `null` when not applicable.
     */
    finishedAt?: string | null
    /**
     * Timestamp used for ordering within the inbox.
     *
     * For attempt-derived items this typically mirrors `finishedAt` for
     * terminal states or the latest update time for active ones.
     */
    lastUpdatedAt?: string | null
    /**
     * URL of the related pull request, when available.
     */
    prUrl?: string | null
    /**
     * Short human-readable summary of an error, when applicable.
     *
     * For failed inbox items this will always be populated.
     */
    errorSummary?: string
    /**
     * Small structured extension bag for future UI needs.
     */
    meta?: Record<string, unknown>
}

/**
 * Inbox item representing work that requires human review or approval.
 */
export interface ReviewInboxItem extends InboxItemBase {
    /**
     * Discriminant for review items.
     */
    type: 'review'
    /**
     * Optional human-readable reason describing why review is needed.
     */
    reason?: string
}

/**
 * Inbox item representing a notable failure that should be inspected.
 */
export interface FailedInboxItem extends InboxItemBase {
    /**
     * Discriminant for failed items.
     */
    type: 'failed'
    /**
     * Short summary of the failure to display in lists.
     */
    errorSummary: string
}

/**
 * Inbox item representing a long-running or blocked attempt.
 */
export interface StuckInboxItem extends InboxItemBase {
    /**
     * Discriminant for stuck items.
     */
    type: 'stuck'
    /**
     * Duration in seconds that the underlying attempt has been considered
     * stuck.
     */
    stuckForSeconds: number
}

/**
 * Discriminated union of all inbox item variants.
 *
 * Forward-compatibility:
 * - New variants should extend `InboxItemBase` and be added to this union.
 * - Existing consumers must handle unknown `type` values defensively.
 */
export type InboxItem = ReviewInboxItem | FailedInboxItem | StuckInboxItem
export type DashboardInboxItem = InboxItem

/**
 * Aggregated inbox lists for the dashboard.
 *
 * Each list is independently filterable and may be empty when there are no
 * items in that category.
 */
export interface DashboardInbox {
    /**
     * Items requiring human review (e.g. review requested, needs confirmation).
     */
    review: InboxItem[]
    /**
     * Notable failures worth surfacing prominently.
     */
    failed: InboxItem[]
    /**
     * Long-running or blocked items that might require intervention.
     */
    stuck: InboxItem[]
    /**
     * Extension point for counts, pagination flags, or other metadata.
     */
    meta?: Record<string, unknown>
}

/**
 * High-level health status for a project.
 *
 * This is intentionally coarse and suitable for badges or color coding.
 */
export type ProjectHealthStatus = 'healthy' | 'degraded' | 'failing' | 'disabled'

/**
 * Canonical per-column card counts used by the dashboard for project
 * snapshots.
 *
 * Implementations should map provider-specific columns into these buckets
 * and default missing buckets to `0` so that consumers can reliably sort
 * and filter without additional null checks. Unknown or custom column
 * titles MAY be treated as "in progress" by the aggregation layer so that
 * open work is not accidentally dropped from activity metrics.
 */
export interface ProjectColumnCardCounts {
    /**
     * Cards in "backlog" style columns (e.g. Todo, Backlog, Ready).
     */
    backlog: number
    /**
     * Cards in active work columns (e.g. In Progress, Doing).
     */
    inProgress: number
    /**
     * Cards in review-oriented columns (e.g. Review, PR Review).
     */
    review: number
    /**
     * Cards in a terminal "done" style column.
     */
    done: number
}

/**
 * Derived health signals for a single project/board within the selected
 * dashboard time range.
 *
 * All fields are designed for direct consumption by the dashboard UI for
 * sorting, filtering, and highlighting projects by activity and risk.
 */
export interface ProjectHealth {
    /**
     * Activity score combining open card volume and attempt activity.
     *
     * The score is a simple weighted sum and is not normalized to a fixed
     * range; callers should treat it as a relative measure when comparing
     * projects within the same snapshot.
     */
    activityScore: number
    /**
     * Failure rate for attempts within the selected `DashboardOverview.timeRange`.
     *
     * Expressed as a fraction between `0` and `1`. When there are no attempts
     * in range this is `0` to avoid `NaN`.
     */
    failureRateInRange: number
    /**
     * Heuristic flag indicating that the project is currently high-activity.
     */
    isHighActivity: boolean
    /**
     * Heuristic flag indicating that the project is at risk due to a
     * combination of high failure rate and sufficient attempt volume.
     */
    isAtRisk: boolean
    /**
     * Optional short machine-generated explanation describing why the project
     * was classified as high-activity or at-risk.
     */
    notes?: string
}

/**
 * Snapshot of a project's health and workload within the selected time range.
 *
 * This shape reflects how the Dashboard UI consumes project data today while
 * allowing additional health metrics to be added over time.
 */
export interface ProjectSnapshot {
    /**
     * Canonical project identifier.
     */
    projectId: ProjectId
    /**
     * Backwards-compatible alias for `projectId` used by existing UI code.
     */
    id: ProjectId
    /**
     * Human-friendly project name.
     */
    name: string
    /**
     * High-level health status derived from recent activity and errors.
     *
     * Implementations may start by treating all projects as `"healthy"` and
     * refine logic iteratively.
     */
    status: ProjectHealthStatus
    /**
     * Repository slug (e.g. `owner/repo`) when known.
     */
    repositorySlug?: string | null
    /**
     * Local repository path or checkout root when known.
     */
    repositoryPath?: string | null
    /**
     * UTC ISO 8601 timestamp when the project/board was created, when known.
     */
    createdAt?: string
    /**
     * Total number of cards on the board.
     */
    totalCards?: number
    /**
     * Number of cards not in a "Done" column.
     */
    openCards?: number
    /**
     * Canonical per-column card counts for this project.
     *
     * Implementations SHOULD always populate all buckets with `0` when there
     * are no cards in a given category.
     */
    columnCardCounts?: ProjectColumnCardCounts
    /**
     * Number of active attempts associated with this project.
     *
     * This field is preserved for backwards compatibility; prefer
     * `activeAttemptsCount` for new code.
     */
    activeAttempts?: number
    /**
     * Number of active attempts associated with this project.
     */
    activeAttemptsCount?: number
    /**
     * Number of attempts attributed to this project that fall within the
     * selected `DashboardOverview.timeRange`.
     */
    attemptsInRange?: number
    /**
     * Number of attempts within the selected `DashboardOverview.timeRange`
     * that ended in a failure status.
     */
    failedAttemptsInRange?: number
    /**
     * Failure rate for attempts within the selected `DashboardOverview.timeRange`.
     *
     * Derived as `failedAttemptsInRange / attemptsInRange` when
     * `attemptsInRange > 0`, otherwise `0`.
     */
    failureRateInRange?: number
    /**
     * Optional health score (0–100) derived from errors, latency, and
     * throughput.
     */
    healthScore?: number
    /**
     * Error rate over the selected time range, either as a fraction (0–1) or
     * percentage (0–100), depending on implementation.
     */
    errorRate?: number
    /**
     * Throughput across the selected time range (e.g. attempts per range).
     */
    throughput?: number
    /**
     * P95 attempt latency in milliseconds over the selected time range.
     */
    p95LatencyMs?: number
    /**
     * Count of recent failures within the selected time range.
     */
    recentFailuresCount?: number
    /**
     * Derived health signals for this project, combining card counts and
     * attempt activity into activity and risk heuristics.
     */
    health?: ProjectHealth
    /**
     * Extension point for project-specific annotations, tags, or metrics.
     */
    meta?: Record<string, unknown>
}

/**
 * Backwards-compatible alias for historical naming.
 *
 * Prefer `ProjectSnapshot` for new code.
 */
export type DashboardProjectSnapshot = ProjectSnapshot

/**
 * High-level runtime status for an agent.
 */
export type AgentStatus = 'online' | 'offline' | 'degraded'

/**
 * Summary statistics for an agent over the selected time range.
 *
 * This is used to populate per-agent tiles on the dashboard; it is scoped to
 * the same `DashboardTimeRange` as the rest of the overview.
 */
export interface AgentStatsSummary {
    /**
     * Stable identifier for the agent (e.g. `"CODEX"`).
     */
    agentId: AgentKey | string
    /**
     * Human-friendly display name for the agent.
     */
    agentName: string
    /**
     * High-level runtime status of the agent.
     */
    status: AgentStatus
    /**
     * Count of attempts started by this agent within the time range.
     *
     * Implementations SHOULD keep this consistent with `attemptsInRange`
     * so that clients can treat them as aliases.
     */
    attemptsStarted: number
    /**
     * Count of attempts that completed successfully within the time range.
     */
    attemptsSucceeded: number
    /**
     * Count of attempts that failed within the time range.
     */
    attemptsFailed: number
    /**
     * Success rate as a fraction (0–1) or percentage (0–100), depending on
     * implementation.
     */
    successRate?: number
    /**
     * Count of attempts where `createdAt` falls within the parent
     * `DashboardOverview.timeRange`.
     *
     * This is kept explicit (even though it currently matches
     * `attemptsStarted`) to simplify UI code that needs to reason about
     * "attempts in range" semantics.
     */
    attemptsInRange?: number
    /**
     * Success rate for attempts within the selected time range.
     *
     * Expressed as a fraction between `0` and `1`. When there are no
     * attempts in range this should be `null` so that consumers can
     * distinguish "no data" from "0%".
     */
    successRateInRange?: number | null
    /**
     * Average end-to-end latency in milliseconds for attempts handled by this
     * agent over the time range.
     */
    avgLatencyMs?: number
    /**
     * Number of currently active attempts attributed to this agent.
     */
    currentActiveAttempts?: number
    /**
     * UTC ISO 8601 timestamp when this agent was last observed doing work.
     *
     * When the agent has never been observed in the selected time range this
     * MAY be omitted or `null`; prefer `lastActivityAt` and
     * `hasActivityInRange` for range-scoped dashboards.
     */
    lastActiveAt?: string
    /**
     * UTC ISO 8601 timestamp of the most recent attempt for this agent that
     * falls within the selected `DashboardOverview.timeRange`.
     *
     * When there are no attempts in range this should be `null`.
     */
    lastActivityAt?: string | null
    /**
     * Convenience flag indicating whether the agent has any attempt activity
     * within the selected `DashboardOverview.timeRange`.
     *
     * Derived as `attemptsInRange > 0`.
     */
    hasActivityInRange?: boolean
    /**
     * Extension point for agent-specific metrics or labels.
     */
    meta?: Record<string, unknown>
}

/**
 * Optional metadata attached to a dashboard overview payload.
 *
 * This is the primary place to expose versioning information and feature
 * flags without changing the core response shape.
 */
export interface DashboardOverviewMeta {
    /**
     * Optional payload version string.
     *
     * When present, this should use a monotonically increasing scheme so
     * clients can branch on format differences if necessary.
     */
    version?: string
    /**
     * Time range presets currently supported by the backend.
     */
    availableTimeRangePresets?: DashboardTimeRangePreset[]
    /**
     * High-level feature flags relevant to the dashboard UI.
     */
    featureFlags?: Record<string, boolean>
    /**
     * Catch-all for additional metadata that does not justify a dedicated
     * field. Clients should treat unknown keys as opaque.
     */
    extra?: Record<string, unknown>
}

/**
 * Root snapshot returned by the Mission Control dashboard overview API.
 *
 * All counts, rates, and time-series metrics are scoped to `timeRange`.
 *
 * Forward-compatibility guidelines:
 * - New top-level sections should be added as optional fields.
 * - New fields within existing sections should be optional.
 * - New metric series should be introduced under `metrics.byKey` first.
 */
export interface DashboardOverview {
    /**
     * Time window that all metrics and aggregates in this overview are scoped
     * to.
     */
    timeRange: DashboardTimeRange
    /**
     * UTC ISO 8601 timestamp when this overview snapshot was generated.
     *
     * Clients should treat this as the authoritative "last updated" time
     * rather than deriving it from any sub-field.
     */
    generatedAt: string
    /**
     * Backwards-compatible alias for `generatedAt` used by older clients.
     *
     * New code should prefer `generatedAt`.
     */
    updatedAt?: string
    /**
     * Aggregated metrics and time-series used for charts and headline
     * numbers.
     */
    metrics: DashboardMetrics
    /**
     * Summary of currently active attempts (running or queued).
     *
     * The array is required but may be empty when there is no active work.
     */
    activeAttempts: ActiveAttemptSummary[]
    /**
     * Recent attempt activity ordered by most recent first.
     *
     * The array is required but may be empty when there is no recent
     * activity.
     */
    recentAttemptActivity: AttemptActivityItem[]
    /**
     * Actionable inbox items grouped by category.
     */
    inboxItems: DashboardInbox
    /**
     * Per-project health and workload snapshots visible to the current user.
     */
    projectSnapshots: ProjectSnapshot[]
    /**
     * Per-agent summary statistics over the selected time range.
     */
    agentStats: AgentStatsSummary[]
    /**
     * Total number of attempts that fall within the selected `timeRange`.
     *
     * Implementations SHOULD keep this consistent with the window used for
     * attempt-related metrics (e.g. success rate, per-project activity).
     */
    attemptsInRange?: number
    /**
     * Success rate for attempts within the selected `timeRange`.
     *
     * Expressed as a fraction between 0–1 unless otherwise documented; when
     * there are no attempts in the window this should be `0`.
     */
    successRateInRange?: number
    /**
     * Number of distinct projects/boards that have any attempt activity
     * within the selected `timeRange`.
     */
    projectsWithActivityInRange?: number
    /**
     * Optional metadata and feature flags associated with this overview.
     */
    meta?: DashboardOverviewMeta
}
