import {and, desc, eq, gte, inArray, lt, sql} from 'drizzle-orm'
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
import {attempts, boards, cards, columns} from '../db/schema'
import {resolveDb} from '../db/with-tx'
import {resolveTimeBounds, resolveTimeRange} from './time-range'
import {buildDashboardInbox} from './inbox'
import {buildProjectHealth} from './project-health'

const ACTIVE_STATUSES: AttemptStatus[] = ['queued', 'running', 'stopping']
const COMPLETED_STATUSES: AttemptStatus[] = ['succeeded', 'failed', 'stopped']

type BoardRow = {
    id: string
    name: string
    repositorySlug: string | null
    repositoryPath: string
    createdAt: Date | number
}

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

    // Fallback: treat unknown columns as in-progress so that totals remain
    // consistent and open work is still reflected in activity scores.
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

function buildTimeRangePredicate(column: any, rangeFrom: Date | null, rangeTo: Date | null) {
    const predicates = []
    if (rangeFrom) predicates.push(gte(column, rangeFrom))
    if (rangeTo) predicates.push(lt(column, rangeTo))
    if (predicates.length === 0) return undefined
    if (predicates.length === 1) return predicates[0]
    return and(...predicates)
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
    const {from: rangeFrom, to: rangeTo} = resolveTimeBounds(resolvedRange)
    const generatedAt = new Date().toISOString()

    const [{count: totalProjectsRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(boards)

    const attemptsTimePredicate = buildTimeRangePredicate(attempts.createdAt, rangeFrom, rangeTo)

    let attemptsRangeQuery = db
        .select({
            total: sql<number>`cast(count(*) as integer)`,
            succeeded: sql<number>`cast(sum(case when ${attempts.status} = 'succeeded' then 1 else 0 end) as integer)`,
        })
        .from(attempts)

    if (attemptsTimePredicate) {
        attemptsRangeQuery = attemptsRangeQuery.where(attemptsTimePredicate)
    }

    const [
        {total: attemptsInRangeRaw = 0, succeeded: attemptsSucceededInRangeRaw = 0} = {
            total: 0,
            succeeded: 0,
        },
    ] = await attemptsRangeQuery

    let projectsWithActivityQuery = db
        .select({
            count: sql<number>`cast(count(distinct ${attempts.boardId}) as integer)`,
        })
        .from(attempts)

    if (attemptsTimePredicate) {
        projectsWithActivityQuery = projectsWithActivityQuery.where(attemptsTimePredicate)
    }

    const [{count: projectsWithActivityInRangeRaw = 0} = {count: 0}] = await projectsWithActivityQuery

    const [{count: activeAttemptsRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(attempts)
        .where(inArray(attempts.status, ACTIVE_STATUSES))

    const attemptsCompletedTimePredicate = buildTimeRangePredicate(attempts.endedAt, rangeFrom, rangeTo)

    const attemptsCompletedWhere = attemptsCompletedTimePredicate
        ? and(inArray(attempts.status, COMPLETED_STATUSES), attemptsCompletedTimePredicate)
        : inArray(attempts.status, COMPLETED_STATUSES)

    const [{count: attemptsCompletedRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(attempts)
        .where(attemptsCompletedWhere)

    type ColumnCountRow = {
        boardId: string
        columnTitle: string
        count: number | null
    }

    const columnCountRows = (await db
        .select({
            boardId: columns.boardId,
            columnTitle: columns.title,
            count: sql<number>`cast(count(*) as integer)`,
        })
        .from(columns)
        .innerJoin(cards, eq(cards.columnId, columns.id))
        .groupBy(columns.boardId, columns.title)) as ColumnCountRow[]

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

    type AttemptsPerBoardRow = {
        boardId: string | null
        total: number | null
        failed: number | null
    }

    let attemptsPerBoardQuery = db
        .select({
            boardId: attempts.boardId,
            total: sql<number>`cast(count(*) as integer)`,
            failed: sql<number>`cast(sum(case when ${attempts.status} = 'failed' then 1 else 0 end) as integer)`,
        })
        .from(attempts)

    if (attemptsTimePredicate) {
        attemptsPerBoardQuery = attemptsPerBoardQuery.where(attemptsTimePredicate)
    }

    const attemptsPerBoardRows = (await attemptsPerBoardQuery.groupBy(
        attempts.boardId,
    )) as AttemptsPerBoardRow[]

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
        })
        .from(boards)
        .orderBy(desc(boards.createdAt))
        .limit(6)) as BoardRow[]

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

    const totalProjects = Number(totalProjectsRaw ?? 0)
    const activeAttemptsCount = Number(activeAttemptsRaw ?? 0)
    const attemptsCompleted = Number(attemptsCompletedRaw ?? 0)
    const attemptsInRange = Number(attemptsInRangeRaw ?? 0)
    const attemptsSucceededInRange = Number(attemptsSucceededInRangeRaw ?? 0)
    const projectsWithActivityInRange = Number(projectsWithActivityInRangeRaw ?? 0)

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

    const metrics: DashboardMetrics = {
        byKey: metricsByKey,
    }

    const inboxItems: DashboardInbox = await buildDashboardInbox(rangeFrom, rangeTo)

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
        attemptsInRange,
        successRateInRange,
        projectsWithActivityInRange,
        meta: {
            availableTimeRangePresets: ['last_24h', 'last_7d', 'last_30d', 'last_90d', 'all_time'],
        },
    }
}
