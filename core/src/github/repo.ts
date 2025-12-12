import {and, eq, sql} from 'drizzle-orm'
import {githubConnections, githubIssues, githubAppConfigs, type GithubConnection, type GithubAppConfigRow} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

const SINGLETON_ID = 'default'
const APP_CONFIG_ID = 'singleton'

export type GithubConnectionUpsert = {
    username: string
    primaryEmail: string | null
    accessToken: string
    tokenType: string
    scope: string | null
}

export async function getGithubConnection(executor?: DbExecutor): Promise<GithubConnection | null> {
    const database = resolveDb(executor)
    const [row] = await database
        .select()
        .from(githubConnections)
        .where(eq(githubConnections.id, SINGLETON_ID))
        .limit(1)
    return row ?? null
}

export async function upsertGithubConnection(data: GithubConnectionUpsert, executor?: DbExecutor): Promise<GithubConnection> {
    const database = resolveDb(executor)
    const now = new Date()
    await database
        .insert(githubConnections)
        .values({
            id: SINGLETON_ID,
            username: data.username,
            primaryEmail: data.primaryEmail,
            accessToken: data.accessToken,
            tokenType: data.tokenType,
            scope: data.scope ?? null,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: githubConnections.id,
            set: {
                username: data.username,
                primaryEmail: data.primaryEmail,
                accessToken: data.accessToken,
                tokenType: data.tokenType,
                scope: data.scope ?? null,
                updatedAt: now,
            },
        })
        .run()

    const connection = await getGithubConnection(database)
    if (!connection) {
        throw new Error('Failed to persist GitHub connection')
    }
    return connection
}

export async function deleteGithubConnection(executor?: DbExecutor): Promise<void> {
    const database = resolveDb(executor)
    await database.delete(githubConnections).where(eq(githubConnections.id, SINGLETON_ID)).run()
}

export type GithubAppConfigUpsert = {
    clientId: string
    clientSecret?: string | null
}

export async function getGithubAppConfig(executor?: DbExecutor): Promise<GithubAppConfigRow | null> {
    const database = resolveDb(executor)
    const [row] = await database.select().from(githubAppConfigs).where(eq(githubAppConfigs.id, APP_CONFIG_ID)).limit(1)
    return row ?? null
}

export async function upsertGithubAppConfig(values: GithubAppConfigUpsert, executor?: DbExecutor): Promise<GithubAppConfigRow> {
    const database = resolveDb(executor)
    const existing = await getGithubAppConfig(database)
    const secretToStore =
        values.clientSecret === undefined ? existing?.clientSecret ?? null : values.clientSecret
    const now = new Date()
    await database
        .insert(githubAppConfigs)
        .values({
            id: APP_CONFIG_ID,
            clientId: values.clientId,
            clientSecret: secretToStore,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: githubAppConfigs.id,
            set: {
                clientId: values.clientId,
                clientSecret: secretToStore,
                updatedAt: now,
            },
        })
        .run()

    const saved = await getGithubAppConfig(database)
    if (!saved) throw new Error('Failed to persist GitHub app config')
    return saved
}

export async function findGithubIssueMapping(
    boardId: string,
    owner: string,
    repo: string,
    issueNumber: number,
    executor?: DbExecutor,
) {
    const database = resolveDb(executor)
    const [row] = await database
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
}

export async function insertGithubIssueMapping(values: typeof githubIssues.$inferInsert, executor?: DbExecutor) {
    const database = resolveDb(executor)
    await database.insert(githubIssues).values(values).run()
}

export async function updateGithubIssueMapping(id: string, patch: Partial<typeof githubIssues.$inferInsert>, executor?: DbExecutor) {
    const database = resolveDb(executor)
    await database.update(githubIssues).set(patch).where(eq(githubIssues.id, id)).run()
}

export async function findGithubIssueMappingByCardId(cardId: string, executor?: DbExecutor) {
    const database = resolveDb(executor)
    const [row] = await database
        .select()
        .from(githubIssues)
        .where(eq(githubIssues.cardId, cardId))
        .limit(1)
    return row ?? null
}

export async function listGithubIssueMappingsByCardId(cardId: string, executor?: DbExecutor) {
    const database = resolveDb(executor)
    const rows = await database
        .select()
        .from(githubIssues)
        .where(eq(githubIssues.cardId, cardId))
    return rows ?? []
}

export type GithubIssueDirection = 'imported' | 'exported'

export type GithubIssueStats = {
    imported: number
    exported: number
    total: number
}

export async function getGithubIssueStats(boardId: string, executor?: DbExecutor): Promise<GithubIssueStats> {
    const database = resolveDb(executor)
    const rows = await database
        .select({
            direction: githubIssues.direction,
            count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(githubIssues)
        .where(eq(githubIssues.boardId, boardId))
        .groupBy(githubIssues.direction)

    let imported = 0
    let exported = 0
    for (const row of rows) {
        if (row.direction === 'exported') exported = row.count
        else imported = row.count
    }
    const total = imported + exported
    return {imported, exported, total}
}
