import {and, desc, eq, gte, inArray, sql} from 'drizzle-orm'
import type {
    DashboardOverview,
    DashboardAttemptSummary,
    DashboardAttemptActivity,
    DashboardProjectSnapshot,
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
        agent: row.agent,
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
    return {
        attemptId: row.attemptId,
        projectId: row.projectId,
        projectName: row.projectName,
        cardId: row.cardId,
        cardTitle: row.cardTitle,
        ticketKey: row.ticketKey,
        agent: row.agent,
        status: row.status as AttemptStatus,
        finishedAt: toIso(row.finishedAt),
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
    return {
        id: row.id,
        name: row.name,
        repositorySlug: row.repositorySlug,
        repositoryPath: row.repositoryPath,
        createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
        activeAttempts: row.activeAttempts,
        openCards: row.openCards,
        totalCards: row.totalCards,
    }
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
    const db = resolveDb()

    const [{count: totalProjectsRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(boards)

    const [{count: activeAttemptsRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(attempts)
        .where(inArray(attempts.status, ACTIVE_STATUSES))

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [{count: attemptsLast24hRaw = 0} = {count: 0}] = await db
        .select({count: sql<number>`cast(count(*) as integer)`})
        .from(attempts)
        .where(and(inArray(attempts.status, COMPLETED_STATUSES), gte(attempts.endedAt, since)))

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

    return {
        metrics: {
            totalProjects: Number(totalProjectsRaw ?? 0),
            activeAttempts: Number(activeAttemptsRaw ?? 0),
            attemptsLast24h: Number(attemptsLast24hRaw ?? 0),
            openCards: openCardsTotal,
        },
        activeAttempts,
        recentAttemptActivity,
        projectSnapshots,
        updatedAt: new Date().toISOString(),
    }
}
