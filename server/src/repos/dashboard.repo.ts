import {and, desc, eq, gte, inArray, lt, sql} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {attempts, boards, cards, columns} from '../db/schema'
import type {
    DashboardRepo,
    DashboardColumnCountRow,
    DashboardActiveCountRow,
    DashboardAttemptsPerBoardRow,
    DashboardActiveAttemptRow,
    DashboardRecentActivityRow,
    DashboardBoardRow,
    DashboardAgentAggregateRow,
    DashboardAgentLifetimeRow,
    DashboardAttemptRowForInbox,
} from 'core/repos/interfaces'

const ACTIVE_STATUSES = ['queued', 'running', 'stopping']
const COMPLETED_STATUSES = ['succeeded', 'failed', 'stopped']

function buildTimeRangePredicate(
    column: typeof attempts.createdAt | typeof attempts.endedAt,
    rangeFrom: Date | null,
    rangeTo: Date | null,
) {
    const predicates = []
    if (rangeFrom) predicates.push(gte(column, rangeFrom))
    if (rangeTo) predicates.push(lt(column, rangeTo))
    if (predicates.length === 0) return undefined
    if (predicates.length === 1) return predicates[0]
    return and(...predicates)
}

export function createDashboardRepo(db: BunSQLiteDatabase): DashboardRepo {
    return {
        async countBoards(): Promise<number> {
            const [row] = await db.select({count: sql<number>`cast(count(*) as integer)`}).from(boards)
            return row?.count ?? 0
        },

        async countAttemptsInRange(
            rangeFrom: Date | null,
            rangeTo: Date | null,
        ): Promise<{total: number; succeeded: number}> {
            const timePredicate = buildTimeRangePredicate(attempts.createdAt, rangeFrom, rangeTo)
            const baseQuery = db
                .select({
                    total: sql<number>`cast(count(*) as integer)`,
                    succeeded: sql<number>`cast(sum(case when ${attempts.status} = 'succeeded' then 1 else 0 end) as integer)`,
                })
                .from(attempts)

            const [row] = timePredicate
                ? await baseQuery.where(timePredicate)
                : await baseQuery

            return {total: row?.total ?? 0, succeeded: row?.succeeded ?? 0}
        },

        async countProjectsWithActivityInRange(rangeFrom: Date | null, rangeTo: Date | null): Promise<number> {
            const timePredicate = buildTimeRangePredicate(attempts.createdAt, rangeFrom, rangeTo)
            const baseQuery = db.select({count: sql<number>`cast(count(distinct ${attempts.boardId}) as integer)`}).from(attempts)

            const [row] = timePredicate
                ? await baseQuery.where(timePredicate)
                : await baseQuery

            return row?.count ?? 0
        },

        async countActiveAttempts(): Promise<number> {
            const [row] = await db
                .select({count: sql<number>`cast(count(*) as integer)`})
                .from(attempts)
                .where(inArray(attempts.status, ACTIVE_STATUSES))
            return row?.count ?? 0
        },

        async countCompletedAttemptsInRange(rangeFrom: Date | null, rangeTo: Date | null): Promise<number> {
            const timePredicate = buildTimeRangePredicate(attempts.endedAt, rangeFrom, rangeTo)
            const completedWhere = timePredicate
                ? and(inArray(attempts.status, COMPLETED_STATUSES), timePredicate)
                : inArray(attempts.status, COMPLETED_STATUSES)

            const [row] = await db
                .select({count: sql<number>`cast(count(*) as integer)`})
                .from(attempts)
                .where(completedWhere)
            return row?.count ?? 0
        },

        async getColumnCardCounts(): Promise<DashboardColumnCountRow[]> {
            const rows = await db
                .select({
                    boardId: columns.boardId,
                    columnTitle: columns.title,
                    count: sql<number>`cast(count(*) as integer)`,
                })
                .from(columns)
                .innerJoin(cards, eq(cards.columnId, columns.id))
                .groupBy(columns.boardId, columns.title)

            return rows.map((row) => ({
                boardId: row.boardId,
                columnTitle: row.columnTitle,
                count: row.count,
            }))
        },

        async getActiveAttemptCountsByBoard(): Promise<DashboardActiveCountRow[]> {
            const rows = await db
                .select({
                    boardId: attempts.boardId,
                    count: sql<number>`cast(count(*) as integer)`,
                })
                .from(attempts)
                .where(inArray(attempts.status, ACTIVE_STATUSES))
                .groupBy(attempts.boardId)

            return rows.map((row) => ({boardId: row.boardId, count: row.count ?? 0}))
        },

        async getAttemptsPerBoardInRange(
            rangeFrom: Date | null,
            rangeTo: Date | null,
        ): Promise<DashboardAttemptsPerBoardRow[]> {
            const timePredicate = buildTimeRangePredicate(attempts.createdAt, rangeFrom, rangeTo)
            const baseQuery = db
                .select({
                    boardId: attempts.boardId,
                    total: sql<number>`cast(count(*) as integer)`,
                    failed: sql<number>`cast(sum(case when ${attempts.status} = 'failed' then 1 else 0 end) as integer)`,
                })
                .from(attempts)

            const rows = timePredicate
                ? await baseQuery.where(timePredicate).groupBy(attempts.boardId)
                : await baseQuery.groupBy(attempts.boardId)

            return rows.map((row) => ({
                boardId: row.boardId,
                total: row.total,
                failed: row.failed,
            }))
        },

        async getActiveAttemptRows(limit: number): Promise<DashboardActiveAttemptRow[]> {
            const rows = await db
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
                .limit(limit)

            return rows.map((row) => ({
                attemptId: row.attemptId,
                projectId: row.projectId,
                projectName: row.projectName,
                cardId: row.cardId,
                cardTitle: row.cardTitle,
                ticketKey: row.ticketKey,
                agent: row.agent,
                status: row.status,
                startedAt: row.startedAt,
                updatedAt: row.updatedAt,
            }))
        },

        async getRecentActivityRows(
            rangeFrom: Date | null,
            rangeTo: Date | null,
            limit: number,
        ): Promise<DashboardRecentActivityRow[]> {
            const timePredicate = buildTimeRangePredicate(attempts.endedAt, rangeFrom, rangeTo)
            const completedWhere = timePredicate
                ? and(inArray(attempts.status, COMPLETED_STATUSES), timePredicate)
                : inArray(attempts.status, COMPLETED_STATUSES)

            const rows = await db
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
                    startedAt: attempts.startedAt,
                    createdAt: attempts.createdAt,
                })
                .from(attempts)
                .leftJoin(cards, eq(attempts.cardId, cards.id))
                .leftJoin(boards, eq(attempts.boardId, boards.id))
                .where(completedWhere)
                .orderBy(desc(sql`coalesce(${attempts.endedAt}, ${attempts.updatedAt}, ${attempts.createdAt})`))
                .limit(limit)

            return rows.map((row) => ({
                attemptId: row.attemptId,
                projectId: row.projectId,
                projectName: row.projectName,
                cardId: row.cardId,
                cardTitle: row.cardTitle,
                ticketKey: row.ticketKey,
                agent: row.agent,
                status: row.status,
                finishedAt: row.finishedAt,
                startedAt: row.startedAt,
                createdAt: row.createdAt,
            }))
        },

        async getBoardRows(limit: number): Promise<DashboardBoardRow[]> {
            const rows = await db
                .select({
                    id: boards.id,
                    name: boards.name,
                    repositorySlug: boards.repositorySlug,
                    repositoryPath: boards.repositoryPath,
                    createdAt: boards.createdAt,
                })
                .from(boards)
                .orderBy(desc(boards.createdAt))
                .limit(limit)

            return rows.map((row) => ({
                id: row.id,
                name: row.name,
                repositorySlug: row.repositorySlug,
                repositoryPath: row.repositoryPath,
                createdAt: row.createdAt,
            }))
        },

        async getAgentAggregates(
            agentKeys: string[],
            rangeFrom: Date | null,
            rangeTo: Date | null,
        ): Promise<DashboardAgentAggregateRow[]> {
            if (agentKeys.length === 0) return []

            const timePredicate = buildTimeRangePredicate(attempts.createdAt, rangeFrom, rangeTo)
            const agentPredicates = [inArray(attempts.agent, agentKeys)]
            if (timePredicate) agentPredicates.push(timePredicate)
            const agentWhere = agentPredicates.length === 1 ? agentPredicates[0] : and(...agentPredicates)

            const rows = await db
                .select({
                    agent: attempts.agent,
                    attemptsInRange: sql<number>`cast(count(*) as integer)`,
                    succeededInRange: sql<number>`cast(sum(case when ${attempts.status} = 'succeeded' then 1 else 0 end) as integer)`,
                    failedInRange: sql<number>`cast(sum(case when ${attempts.status} = 'failed' then 1 else 0 end) as integer)`,
                    lastActivityAt: sql<Date | null>`max(${attempts.createdAt})`,
                })
                .from(attempts)
                .where(agentWhere)
                .groupBy(attempts.agent)

            return rows.map((row) => ({
                agent: row.agent,
                attemptsInRange: row.attemptsInRange,
                succeededInRange: row.succeededInRange,
                failedInRange: row.failedInRange,
                lastActivityAt: row.lastActivityAt,
            }))
        },

        async getAgentLifetimeStats(agentKeys: string[]): Promise<DashboardAgentLifetimeRow[]> {
            if (agentKeys.length === 0) return []

            const rows = await db
                .select({
                    agent: attempts.agent,
                    lastActiveAt: sql<Date | null>`max(${attempts.createdAt})`,
                })
                .from(attempts)
                .where(inArray(attempts.agent, agentKeys))
                .groupBy(attempts.agent)

            return rows.map((row) => ({
                agent: row.agent,
                lastActiveAt: row.lastActiveAt,
            }))
        },

        async getInboxAttemptRows(
            rangeFrom: Date | null,
            rangeTo: Date | null,
            limit: number,
        ): Promise<DashboardAttemptRowForInbox[]> {
            const timePredicate = buildTimeRangePredicate(attempts.createdAt, rangeFrom, rangeTo)
            const baseQuery = db
                .select({
                    attemptId: attempts.id,
                    projectId: attempts.boardId,
                    projectName: boards.name,
                    cardId: cards.id,
                    cardTitle: cards.title,
                    ticketKey: cards.ticketKey,
                    prUrl: cards.prUrl,
                    cardStatus: columns.title,
                    agent: attempts.agent,
                    status: attempts.status,
                    createdAt: attempts.createdAt,
                    updatedAt: attempts.updatedAt,
                    startedAt: attempts.startedAt,
                    endedAt: attempts.endedAt,
                })
                .from(attempts)
                .leftJoin(boards, eq(attempts.boardId, boards.id))
                .leftJoin(cards, eq(attempts.cardId, cards.id))
                .leftJoin(columns, eq(cards.columnId, columns.id))
                .$dynamic()

            const rows = timePredicate
                ? await baseQuery.where(timePredicate).orderBy(desc(attempts.createdAt)).limit(limit)
                : await baseQuery.orderBy(desc(attempts.createdAt)).limit(limit)

            return rows.map((row) => ({
                attemptId: row.attemptId,
                projectId: row.projectId,
                projectName: row.projectName,
                cardId: row.cardId,
                cardTitle: row.cardTitle,
                ticketKey: row.ticketKey,
                prUrl: row.prUrl,
                cardStatus: row.cardStatus,
                agent: row.agent,
                status: row.status,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                startedAt: row.startedAt,
                endedAt: row.endedAt,
            }))
        },
    }
}
