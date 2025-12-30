import {DASHBOARD_METRIC_KEYS} from 'shared'
import type {
    DashboardOverview,
    DashboardAttemptSummary,
    DashboardAttemptActivity,
    DashboardProjectSnapshot,
    DashboardTimeRange,
    DashboardMetrics,
    DashboardMetricSeries,
    DashboardInbox,
    AgentStatsSummary,
    AttemptStatus,
} from 'shared'
import {getDashboardRepo} from '../repos/provider'
import {resolveTimeBounds, resolveTimeRange} from './time-range'
import {buildDashboardInbox} from './inbox'
import {buildProjectHealth} from './project-health'
import {listAgents} from '../agents/registry'

type ColumnCardCounts = {
    backlog: number
    inProgress: number
    review: number
    done: number
}

function toIso(value: Date | number | null | undefined): string | null {
    if (value == null) return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function mapAttemptRow(row: {
    attemptId: string
    projectId: string | null
    projectName: string | null
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    agent: string
    status: string
    startedAt: Date | number | null
    updatedAt: Date | number | null
    endedAt?: Date | number | null
}): DashboardAttemptSummary {
    return {
        attemptId: row.attemptId,
        projectId: row.projectId,
        projectName: row.projectName,
        cardId: row.cardId,
        cardTitle: row.cardTitle,
        ticketKey: row.ticketKey,
        agentId: row.agent,
        status: row.status as AttemptStatus,
        startedAt: toIso(row.startedAt ?? null),
        updatedAt: toIso(row.updatedAt ?? null),
    }
}

function mapActivityRow(row: {
    attemptId: string
    projectId: string | null
    projectName: string | null
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    agent: string
    status: string
    finishedAt: Date | number | null
    startedAt?: Date | number | null
    createdAt?: Date | number | null
}): DashboardAttemptActivity {
    const startedAt: Date | number | null = row.startedAt ?? null
    const createdAt: Date | number | null = row.createdAt ?? null

    const occurredAt = toIso(row.finishedAt) ?? new Date().toISOString()

    let durationSeconds: number | undefined

    const startSource = startedAt ?? createdAt
    if (row.finishedAt && startSource) {
        const startDate = startSource instanceof Date ? startSource : new Date(startSource)
        const endDate = row.finishedAt instanceof Date ? row.finishedAt : new Date(row.finishedAt)
        const diffSeconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000)
        if (Number.isFinite(diffSeconds) && diffSeconds > 0) {
            durationSeconds = diffSeconds
        }
    }

    return {
        attemptId: row.attemptId,
        projectId: row.projectId,
        projectName: row.projectName,
        cardId: row.cardId,
        cardTitle: row.cardTitle,
        ticketKey: row.ticketKey,
        agentId: row.agent,
        status: row.status as AttemptStatus,
        occurredAt,
        durationSeconds,
    }
}

function createEmptyColumnCardCounts(): ColumnCardCounts {
    return {
        backlog: 0,
        inProgress: 0,
        review: 0,
        done: 0,
    }
}

function classifyColumnTitleForDashboard(title: string): keyof ColumnCardCounts {
    const normalized = title.trim().toLowerCase()
    if (!normalized) return 'backlog'

    if (normalized === 'done') {
        return 'done'
    }

    if (
        normalized.includes('review') ||
        normalized.includes('pr ') ||
        normalized.includes('code review')
    ) {
        return 'review'
    }

    if (
        normalized.includes('progress') ||
        normalized.includes('doing') ||
        normalized.includes('active') ||
        normalized.includes('in dev') ||
        normalized.includes('in-development')
    ) {
        return 'inProgress'
    }

    if (
        normalized.includes('backlog') ||
        normalized.includes('todo') ||
        normalized.includes('to-do') ||
        normalized.includes('to do') ||
        normalized.includes('ready')
    ) {
        return 'backlog'
    }

    return 'inProgress'
}

function mapProjectSnapshotRow(row: {
    id: string
    name: string
    repositorySlug: string | null
    repositoryPath: string
    createdAt: Date | number
    activeAttempts: number
    openCards: number
    totalCards: number
    columnCardCounts: ColumnCardCounts
    attemptsInRange: number
    failedAttemptsInRange: number
    failureRateInRange: number
    health: ReturnType<typeof buildProjectHealth>
}): DashboardProjectSnapshot {
    const createdAtIso = toIso(row.createdAt) ?? new Date().toISOString()
    return {
        projectId: row.id,
        id: row.id,
        name: row.name,
        status: 'healthy',
        repositorySlug: row.repositorySlug,
        repositoryPath: row.repositoryPath,
        createdAt: createdAtIso,
        activeAttempts: row.activeAttempts,
        activeAttemptsCount: row.activeAttempts,
        openCards: row.openCards,
        totalCards: row.totalCards,
        columnCardCounts: row.columnCardCounts,
        attemptsInRange: row.attemptsInRange,
        failedAttemptsInRange: row.failedAttemptsInRange,
        failureRateInRange: row.failureRateInRange,
        health: row.health,
    }
}

function buildSingleBucketSeries(
    label: string,
    value: number,
    timeRange: DashboardTimeRange,
): DashboardMetricSeries {
    const {from, to} = timeRange

    if (!from || !to) {
        return {
            label,
            unit: 'count',
            points: [],
            total: value,
        }
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)
    const durationSeconds = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / 1000))

    return {
        label,
        unit: 'count',
        points: [
            {
                timestamp: from,
                value,
                bucketSizeSeconds: durationSeconds,
            },
        ],
        total: value,
    }
}

export async function getDashboardOverview(timeRange?: DashboardTimeRange): Promise<DashboardOverview> {
    const repo = getDashboardRepo()

    const resolvedRange = resolveTimeRange(timeRange)
    const {from: rangeFrom, to: rangeTo} = resolveTimeBounds(resolvedRange)
    const generatedAt = new Date().toISOString()

    const totalProjects = await repo.countBoards()

    const {total: attemptsInRange, succeeded: attemptsSucceededInRange} = await repo.countAttemptsInRange(rangeFrom, rangeTo)

    const projectsWithActivityInRange = await repo.countProjectsWithActivityInRange(rangeFrom, rangeTo)

    const activeAttemptsCount = await repo.countActiveAttempts()

    const attemptsCompleted = await repo.countCompletedAttemptsInRange(rangeFrom, rangeTo)

    const columnCountRows = await repo.getColumnCardCounts()

    const columnCardCountsMap = new Map<string, ColumnCardCounts>()
    const openCardsMap = new Map<string, number>()

    for (const row of columnCountRows) {
        const boardId = row.boardId
        if (!boardId) continue

        let counts = columnCardCountsMap.get(boardId)
        if (!counts) {
            counts = createEmptyColumnCardCounts()
            columnCardCountsMap.set(boardId, counts)
        }

        const bucket = classifyColumnTitleForDashboard(row.columnTitle)
        const increment = Number(row.count ?? 0)

        counts[bucket] += increment
    }

    let openCardsTotal = 0
    for (const [boardId, counts] of columnCardCountsMap.entries()) {
        const openCards = counts.backlog + counts.inProgress + counts.review
        openCardsMap.set(boardId, openCards)
        openCardsTotal += openCards
    }

    const activeCountsRows = await repo.getActiveAttemptCountsByBoard()
    const activeCountsMap = new Map<string, number>()
    for (const row of activeCountsRows) {
        if (!row.boardId) continue
        activeCountsMap.set(row.boardId, Number(row.count ?? 0))
    }

    const attemptsPerBoardRows = await repo.getAttemptsPerBoardInRange(rangeFrom, rangeTo)

    const attemptsInRangeByBoard = new Map<string, number>()
    const failedAttemptsInRangeByBoard = new Map<string, number>()

    for (const row of attemptsPerBoardRows) {
        if (!row.boardId) continue
        const boardId = row.boardId
        const total = Number(row.total ?? 0)
        const failed = Number(row.failed ?? 0)

        attemptsInRangeByBoard.set(boardId, total)
        failedAttemptsInRangeByBoard.set(boardId, failed)
    }

    const activeAttemptsRows = await repo.getActiveAttemptRows(200)

    const activeAttempts = activeAttemptsRows.map(mapAttemptRow)

    const recentActivityRows = await repo.getRecentActivityRows(rangeFrom, rangeTo, 40)

    const recentAttemptActivity = recentActivityRows.map(mapActivityRow)

    const boardRows = await repo.getBoardRows(6)

    const projectSnapshots: DashboardProjectSnapshot[] = boardRows.map((row) => {
        const columnCardCounts = columnCardCountsMap.get(row.id) ?? createEmptyColumnCardCounts()
        const totalCards =
            columnCardCounts.backlog +
            columnCardCounts.inProgress +
            columnCardCounts.review +
            columnCardCounts.done
        const openCards =
            openCardsMap.get(row.id) ??
            columnCardCounts.backlog + columnCardCounts.inProgress + columnCardCounts.review
        const activeAttemptsForBoard = activeCountsMap.get(row.id) ?? 0
        const attemptsInRangeForBoard = attemptsInRangeByBoard.get(row.id) ?? 0
        const failedAttemptsInRangeForBoard = failedAttemptsInRangeByBoard.get(row.id) ?? 0

        const health = buildProjectHealth({
            openCards,
            activeAttempts: activeAttemptsForBoard,
            attemptsInRange: attemptsInRangeForBoard,
            failedAttemptsInRange: failedAttemptsInRangeForBoard,
        })

        return mapProjectSnapshotRow({
            id: row.id,
            name: row.name,
            repositorySlug: row.repositorySlug,
            repositoryPath: row.repositoryPath,
            createdAt: row.createdAt,
            totalCards,
            activeAttempts: activeAttemptsForBoard,
            openCards,
            columnCardCounts,
            attemptsInRange: attemptsInRangeForBoard,
            failedAttemptsInRange: failedAttemptsInRangeForBoard,
            failureRateInRange: health.failureRateInRange,
            health,
        })
    })

    const successRateInRange =
        attemptsInRange > 0 ? attemptsSucceededInRange / attemptsInRange : 0
    const metricsByKey: Record<string, DashboardMetricSeries> = {
        [DASHBOARD_METRIC_KEYS.projectsTotal]: buildSingleBucketSeries(
            'Projects',
            totalProjects,
            resolvedRange,
        ),
        [DASHBOARD_METRIC_KEYS.activeAttempts]: buildSingleBucketSeries(
            'Active Attempts',
            activeAttemptsCount,
            resolvedRange,
        ),
        [DASHBOARD_METRIC_KEYS.attemptsCompleted]: buildSingleBucketSeries(
            'Attempts Completed',
            attemptsCompleted,
            resolvedRange,
        ),
        [DASHBOARD_METRIC_KEYS.openCards]: buildSingleBucketSeries(
            'Open Cards',
            openCardsTotal,
            resolvedRange,
        ),
    }
    const inboxItems: DashboardInbox = await buildDashboardInbox(rangeFrom, rangeTo)
    const inboxMeta = inboxItems.meta as {totalReview?: unknown} | undefined
    const reviewItemsCountFromMeta =
        typeof inboxMeta?.totalReview === 'number' ? inboxMeta.totalReview : undefined
    const reviewItemsCount = reviewItemsCountFromMeta ?? inboxItems.review.length

    const metrics: DashboardMetrics = {
        byKey: metricsByKey,
        activeAttempts: activeAttemptsCount,
        attemptsInRange,
        successRateInRange,
        reviewItemsCount,
        projectsWithActivity: projectsWithActivityInRange,
    }

    const registeredAgents = listAgents()

    let agentStats: AgentStatsSummary[] = []

    if (registeredAgents.length > 0) {
        const agentKeys = registeredAgents.map((agent) => agent.key)

        const agentAggregateRows = await repo.getAgentAggregates(agentKeys, rangeFrom, rangeTo)

        const agentLifetimeRows = await repo.getAgentLifetimeStats(agentKeys)

        const aggregatesByAgent = new Map<
            string,
            {
                attemptsInRange: number
                succeededInRange: number
                failedInRange: number
                lastActivityAt: Date | null
            }
        >()

        for (const row of agentAggregateRows) {
            if (!row.agent) continue
            const key = row.agent
            const attemptsForAgent = Number(row.attemptsInRange ?? 0)
            const succeededForAgent = Number(row.succeededInRange ?? 0)
            const failedForAgent = Number(row.failedInRange ?? 0)
            const lastActivity = row.lastActivityAt ?? null

            aggregatesByAgent.set(key, {
                attemptsInRange: attemptsForAgent,
                succeededInRange: succeededForAgent,
                failedInRange: failedForAgent,
                lastActivityAt: lastActivity,
            })
        }

        const lifetimeByAgent = new Map<string, Date | null>()
        for (const row of agentLifetimeRows) {
            if (!row.agent) continue
            lifetimeByAgent.set(row.agent, row.lastActiveAt ?? null)
        }

        agentStats = registeredAgents
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label))
            .map<AgentStatsSummary>((agent) => {
                const aggregate = aggregatesByAgent.get(agent.key)
                const attemptsInRangeForAgent = aggregate?.attemptsInRange ?? 0
                const succeededInRangeForAgent = aggregate?.succeededInRange ?? 0
                const failedInRangeForAgent = aggregate?.failedInRange ?? 0

                const successRateInRangeForAgent =
                    attemptsInRangeForAgent > 0
                        ? succeededInRangeForAgent / attemptsInRangeForAgent
                        : null

                const lastActivityAtForAgent =
                    aggregate?.lastActivityAt != null
                        ? toIso(aggregate.lastActivityAt)
                        : null

                const hasActivityInRangeForAgent = attemptsInRangeForAgent > 0

                const lifetimeLastActive = lifetimeByAgent.get(agent.key) ?? null
                const lastActiveAtIso =
                    lifetimeLastActive != null ? toIso(lifetimeLastActive) : null

                return {
                    agentId: agent.key,
                    agentName: agent.label,
                    status: 'online',
                    attemptsStarted: attemptsInRangeForAgent,
                    attemptsSucceeded: succeededInRangeForAgent,
                    attemptsFailed: failedInRangeForAgent,
                    successRate: successRateInRangeForAgent ?? undefined,
                    attemptsInRange: attemptsInRangeForAgent,
                    successRateInRange: successRateInRangeForAgent,
                    currentActiveAttempts: undefined,
                    lastActiveAt: lastActiveAtIso ?? undefined,
                    lastActivityAt: lastActivityAtForAgent,
                    hasActivityInRange: hasActivityInRangeForAgent,
                    avgLatencyMs: undefined,
                    meta: undefined,
                }
            })
    }

    return {
        timeRange: resolvedRange,
        generatedAt,
        updatedAt: generatedAt,
        metrics,
        activeAttempts,
        recentAttemptActivity,
        projectSnapshots,
        inboxItems,
        agentStats,
        attemptsInRange,
        successRateInRange,
        projectsWithActivityInRange,
        meta: {
            version: 'v1',
            availableTimeRangePresets: ['last_24h', 'last_7d', 'last_30d', 'last_90d', 'all_time'],
        },
    }
}
