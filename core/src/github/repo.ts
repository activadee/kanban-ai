import {and, eq} from 'drizzle-orm'
import {githubConnections, githubIssues, type GithubConnection} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

const SINGLETON_ID = 'default'

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

