import {and, desc, eq, gte, inArray, sql} from 'drizzle-orm'
import {
    DASHBOARD_METRIC_KEYS,
} from 'shared'
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
import {attempts, boards, cards, columns} from '../db/schema'
import {resolveDb} from '../db/with-tx'

const ACTIVE_STATUSES: AttemptStatus[] = ['queued', 'running', 'stopping']
const COMPLETED_STATUSES: AttemptStatus[] = ['succeeded', 'failed', 'stopped']

type BoardRow = {
    id: string
    name: string
    repositorySlug: string | null
    repositoryPath: string
    createdAt: Date | number
    totalCards: number | null
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
}): DashboardAttemptActivity {
    const occurredAt = toIso(row.finishedAt) ?? new Date().toISOString()
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
    }
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
    }
}

function resolveTimeRange(input?: DashboardTimeRange): DashboardTimeRange {
    const now = new Date()

    if (input?.from && input.to) {
        return {
            ...input,
        }
    }

    const windowMs = 24 * 60 * 60 * 1000
    const from = new Date(now.getTime() - windowMs).toISOString()
    const to = now.toISOString()

    return {
        preset: input?.preset ?? 'last_24h',
        from,
        to,
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
    const db = resolveDb()

    const resolvedRange = resolveTimeRange(timeRange)
    const rangeStart = resolvedRange.from ? new Date(resolvedRange.from) : new Date(Date.now() - 24 * 60 * 60 * 1000)
    const generatedAt = new Date().toISOString()

    const [{count: totalProjectsRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(boards)

    const [{count: activeAttemptsRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(attempts)
        .where(inArray(attempts.status, ACTIVE_STATUSES))

    const [{count: attemptsCompletedRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(attempts)
        .where(and(inArray(attempts.status, COMPLETED_STATUSES), gte(attempts.endedAt, rangeStart)))

    const openCardRows = await db
        .select({
            boardId: columns.boardId,
            count: sql<number>`cast(count(*) as integer)`,
        })
        .from(columns)
        .innerJoin(cards, eq(cards.columnId, columns.id))
        .where(sql`lower(${columns.title}) <> 'done'`)
        .groupBy(columns.boardId)

    const openCardsMap = new Map<string, number>()
    for (const row of openCardRows) {
        if (!row.boardId) continue
        openCardsMap.set(row.boardId, Number(row.count ?? 0))
    }
    const openCardsTotal = Array.from(openCardsMap.values()).reduce((sum, value) => sum + value, 0)

    const activeCountsRows = await db
        .select({
            boardId: attempts.boardId,
            count: sql<number>`cast(count(*) as integer)`,
        })
        .from(attempts)
        .where(inArray(attempts.status, ACTIVE_STATUSES))
        .groupBy(attempts.boardId)

    const activeCountsMap = new Map<string, number>()
    for (const row of activeCountsRows) {
        if (!row.boardId) continue
        activeCountsMap.set(row.boardId, Number(row.count ?? 0))
    }

    const activeAttemptsRows = await db
        .select({
            attemptId: attempts.id,
            projectId: boards.id,
            projectName: boards.name,
            cardId: attempts.cardId,
            cardTitle: cards.title,
            ticketKey: cards.ticketKey,
            agent: attempts.agent,
            status: attempts.status,
            startedAt: attempts.startedAt,
            updatedAt: attempts.updatedAt,
        })
        .from(attempts)
        .leftJoin(cards, eq(attempts.cardId, cards.id))
        .leftJoin(boards, eq(attempts.boardId, boards.id))
        .where(inArray(attempts.status, ACTIVE_STATUSES))
        .orderBy(desc(sql`coalesce(${attempts.updatedAt}, ${attempts.createdAt})`))
        .limit(6)

    const activeAttempts = activeAttemptsRows.map(mapAttemptRow)

    const recentActivityRows = await db
        .select({
            attemptId: attempts.id,
            projectId: boards.id,
            projectName: boards.name,
            cardId: attempts.cardId,
            cardTitle: cards.title,
            ticketKey: cards.ticketKey,
            agent: attempts.agent,
            status: attempts.status,
            finishedAt: sql<Date | null>`coalesce(${attempts.endedAt}, ${attempts.updatedAt}, ${attempts.createdAt})`,
        })
        .from(attempts)
        .leftJoin(cards, eq(attempts.cardId, cards.id))
        .leftJoin(boards, eq(attempts.boardId, boards.id))
        .where(inArray(attempts.status, COMPLETED_STATUSES))
        .orderBy(desc(sql`coalesce(${attempts.endedAt}, ${attempts.updatedAt}, ${attempts.createdAt})`))
        .limit(8)

    const recentAttemptActivity = recentActivityRows.map(mapActivityRow)

    const boardRows = (await db
        .select({
            id: boards.id,
            name: boards.name,
            repositorySlug: boards.repositorySlug,
            repositoryPath: boards.repositoryPath,
            createdAt: boards.createdAt,
            totalCards: sql<number>`(SELECT cast(count(*) as integer) FROM cards WHERE cards.board_id = ${boards.id})`,
        })
        .from(boards)
        .orderBy(desc(boards.createdAt))
        .limit(6)) as BoardRow[]

    const projectSnapshots: DashboardProjectSnapshot[] = boardRows.map((row) =>
        mapProjectSnapshotRow({
            id: row.id,
            name: row.name,
            repositorySlug: row.repositorySlug,
            repositoryPath: row.repositoryPath,
            createdAt: row.createdAt,
            totalCards: Number(row.totalCards ?? 0),
            activeAttempts: activeCountsMap.get(row.id) ?? 0,
            openCards: openCardsMap.get(row.id) ?? 0,
        }),
    )

    const totalProjects = Number(totalProjectsRaw ?? 0)
    const activeAttemptsCount = Number(activeAttemptsRaw ?? 0)
    const attemptsCompleted = Number(attemptsCompletedRaw ?? 0)

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

    const metrics: DashboardMetrics = {
        byKey: metricsByKey,
    }

    const inboxItems: DashboardInbox = {
        review: [],
        failed: [],
        stuck: [],
    }

    const agentStats: AgentStatsSummary[] = []

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
        meta: {
            availableTimeRangePresets: ['last_24h', 'last_7d', 'last_30d', 'last_90d'],
        },
    }
}
