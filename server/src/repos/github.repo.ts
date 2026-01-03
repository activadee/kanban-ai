import {and, eq, inArray, not, sql} from 'drizzle-orm'
import type {DbExecutor} from '../db/client'
import {githubConnections, githubIssues} from '../db/schema/github'
import {cards, columns} from '../db/schema'
import {githubAppConfigs} from '../db/schema/onboarding'
import type {GithubRepo, GithubConnectionUpsert, GithubAppConfigUpsert, GithubIssueStats, GithubIssueUpdate} from 'core/repos/interfaces'
import type {GithubConnectionRow, GithubIssueRow, GithubIssueInsert, GithubAppConfigRow, CardRow} from 'core/db/types'

const SINGLETON_ID = 'singleton'

export function createGithubRepo(db: DbExecutor): GithubRepo {
    return {
        async getGithubConnection(): Promise<GithubConnectionRow | null> {
            const [row] = await db.select().from(githubConnections).limit(1)
            return row ?? null
        },

        async upsertGithubConnection(data: GithubConnectionUpsert): Promise<GithubConnectionRow> {
            const [row] = await db
                .insert(githubConnections)
                .values({
                    id: SINGLETON_ID,
                    username: data.username,
                    primaryEmail: data.primaryEmail,
                    accessToken: data.accessToken,
                    tokenType: data.tokenType,
                    scope: data.scope,
                })
                .onConflictDoUpdate({
                    target: githubConnections.id,
                    set: {
                        username: data.username,
                        primaryEmail: data.primaryEmail,
                        accessToken: data.accessToken,
                        tokenType: data.tokenType,
                        scope: data.scope,
                        updatedAt: new Date(),
                    },
                })
                .returning()
            return row!
        },

        async deleteGithubConnection(): Promise<void> {
            await db.delete(githubConnections).run()
        },

        async getGithubAppConfig(): Promise<GithubAppConfigRow | null> {
            const [row] = await db.select().from(githubAppConfigs).limit(1)
            return row ?? null
        },

        async upsertGithubAppConfig(values: GithubAppConfigUpsert): Promise<GithubAppConfigRow> {
            const [row] = await db
                .insert(githubAppConfigs)
                .values({
                    id: SINGLETON_ID,
                    clientId: values.clientId,
                    clientSecret: values.clientSecret ?? null,
                })
                .onConflictDoUpdate({
                    target: githubAppConfigs.id,
                    set: {
                        clientId: values.clientId,
                        clientSecret: values.clientSecret ?? null,
                        updatedAt: new Date(),
                    },
                })
                .returning()
            return row!
        },

        async findGithubIssueMapping(
            boardId: string,
            owner: string,
            repo: string,
            issueNumber: number,
        ): Promise<GithubIssueRow | null> {
            const [row] = await db
                .select()
                .from(githubIssues)
                .where(
                    and(
                        eq(githubIssues.boardId, boardId),
                        eq(githubIssues.owner, owner),
                        eq(githubIssues.repo, repo),
                        eq(githubIssues.issueNumber, issueNumber),
                    ),
                )
                .limit(1)
            return row ?? null
        },

        async insertGithubIssueMapping(values: GithubIssueInsert): Promise<void> {
            await db.insert(githubIssues).values(values).run()
        },

        async updateGithubIssueMapping(id: string, patch: GithubIssueUpdate): Promise<void> {
            await db.update(githubIssues).set(patch).where(eq(githubIssues.id, id)).run()
        },

        async findGithubIssueMappingByCardId(cardId: string): Promise<GithubIssueRow | null> {
            const [row] = await db.select().from(githubIssues).where(eq(githubIssues.cardId, cardId)).limit(1)
            return row ?? null
        },

        async listGithubIssueMappingsByCardId(cardId: string): Promise<GithubIssueRow[]> {
            return db.select().from(githubIssues).where(eq(githubIssues.cardId, cardId))
        },

        async getGithubIssueStats(boardId: string): Promise<GithubIssueStats> {
            const [row] = await db
                .select({
                    imported: sql<number>`coalesce(sum(case when ${githubIssues.direction} = 'imported' then 1 else 0 end), 0)`,
                    exported: sql<number>`coalesce(sum(case when ${githubIssues.direction} = 'exported' then 1 else 0 end), 0)`,
                    total: sql<number>`count(*)`,
                })
                .from(githubIssues)
                .where(eq(githubIssues.boardId, boardId))
            return {
                imported: row?.imported ?? 0,
                exported: row?.exported ?? 0,
                total: row?.total ?? 0,
            }
        },

        async listCardsWithGithubIssuesNotInDone(
            boardId: string,
            doneColumnIds: string[],
        ): Promise<Array<CardRow & {issueNumber: number; owner: string; repo: string}>> {
            if (doneColumnIds.length === 0) {
                // No Done columns, so query all cards with GitHub issues
                return db
                    .select({
                        id: cards.id,
                        title: cards.title,
                        description: cards.description,
                        order: cards.order,
                        columnId: cards.columnId,
                        boardId: cards.boardId,
                        ticketKey: cards.ticketKey,
                        ticketType: cards.ticketType,
                        isEnhanced: cards.isEnhanced,
                        prUrl: cards.prUrl,
                        disableAutoCloseOnPRMerge: cards.disableAutoCloseOnPRMerge,
                        disableAutoCloseOnIssueClose: cards.disableAutoCloseOnIssueClose,
                        createdAt: cards.createdAt,
                        updatedAt: cards.updatedAt,
                        issueNumber: githubIssues.issueNumber,
                        owner: githubIssues.owner,
                        repo: githubIssues.repo,
                    })
                    .from(cards)
                    .innerJoin(githubIssues, eq(cards.id, githubIssues.cardId))
                    .where(
                        and(
                            eq(cards.boardId, boardId),
                            eq(cards.disableAutoCloseOnIssueClose, false),
                        ),
                    )
            }

            return db
                .select({
                    id: cards.id,
                    title: cards.title,
                    description: cards.description,
                    order: cards.order,
                    columnId: cards.columnId,
                    boardId: cards.boardId,
                    ticketKey: cards.ticketKey,
                    ticketType: cards.ticketType,
                    isEnhanced: cards.isEnhanced,
                    prUrl: cards.prUrl,
                    disableAutoCloseOnPRMerge: cards.disableAutoCloseOnPRMerge,
                    disableAutoCloseOnIssueClose: cards.disableAutoCloseOnIssueClose,
                    createdAt: cards.createdAt,
                    updatedAt: cards.updatedAt,
                    issueNumber: githubIssues.issueNumber,
                    owner: githubIssues.owner,
                    repo: githubIssues.repo,
                })
                .from(cards)
                .innerJoin(githubIssues, eq(cards.id, githubIssues.cardId))
                .where(
                    and(
                        eq(cards.boardId, boardId),
                        not(inArray(cards.columnId, doneColumnIds)),
                        eq(cards.disableAutoCloseOnIssueClose, false),
                    ),
                )
        },
    }
}
