import {beforeEach, describe, expect, it} from 'vitest'
import Database from 'better-sqlite3'
import {setDbProvider} from '../src/db/provider'
import {setRepoProvider} from '../src/repos/provider'
import type {RepoProvider, GithubRepo, GithubIssueStats} from '../src/repos/interfaces'
import type {GithubConnectionRow, GithubIssueRow, GithubIssueInsert, GithubAppConfigRow} from '../src/db/types'

function setupDb() {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
        CREATE TABLE github_issues (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            card_id TEXT NOT NULL,
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            direction TEXT NOT NULL DEFAULT 'imported',
            issue_id TEXT NOT NULL,
            issue_number INTEGER NOT NULL,
            title_snapshot TEXT NOT NULL,
            url TEXT NOT NULL,
            state TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );
    `)

    return sqlite
}

function createMockGithubRepo(sqlite: ReturnType<typeof setupDb>): GithubRepo {
    return {
        async getGithubConnection(): Promise<GithubConnectionRow | null> {
            return null
        },
        async upsertGithubConnection(): Promise<GithubConnectionRow> {
            throw new Error('Not implemented')
        },
        async deleteGithubConnection(): Promise<void> {},
        async getGithubAppConfig(): Promise<GithubAppConfigRow | null> {
            return null
        },
        async upsertGithubAppConfig(): Promise<GithubAppConfigRow> {
            throw new Error('Not implemented')
        },
        async findGithubIssueMapping(): Promise<GithubIssueRow | null> {
            return null
        },
        async insertGithubIssueMapping(_values: GithubIssueInsert): Promise<void> {},
        async updateGithubIssueMapping(): Promise<void> {},
        async findGithubIssueMappingByCardId(): Promise<GithubIssueRow | null> {
            return null
        },
        async listGithubIssueMappingsByCardId(): Promise<GithubIssueRow[]> {
            return []
        },
        async getGithubIssueStats(boardId: string): Promise<GithubIssueStats> {
            const stmt = sqlite.prepare(`
                SELECT
                    coalesce(sum(case when direction = 'imported' then 1 else 0 end), 0) as imported,
                    coalesce(sum(case when direction = 'exported' then 1 else 0 end), 0) as exported,
                    count(*) as total
                FROM github_issues
                WHERE board_id = ?
            `)
            const row = stmt.get(boardId) as {imported: number; exported: number; total: number}
            return {
                imported: row?.imported ?? 0,
                exported: row?.exported ?? 0,
                total: row?.total ?? 0,
            }
        },
    }
}

function createMockRepoProvider(sqlite: ReturnType<typeof setupDb>): RepoProvider {
    const provider: RepoProvider = {
        projects: {} as RepoProvider['projects'],
        projectSettings: {} as RepoProvider['projectSettings'],
        attempts: {} as RepoProvider['attempts'],
        agentProfiles: {} as RepoProvider['agentProfiles'],
        agentProfilesGlobal: {} as RepoProvider['agentProfilesGlobal'],
        github: createMockGithubRepo(sqlite),
        appSettings: {} as RepoProvider['appSettings'],
        onboarding: {} as RepoProvider['onboarding'],
        dependencies: {} as RepoProvider['dependencies'],
        enhancements: {} as RepoProvider['enhancements'],
        dashboard: {} as RepoProvider['dashboard'],

        async withTx<T>(fn: (provider: RepoProvider) => Promise<T>): Promise<T> {
            return fn(provider)
        },
    }
    return provider
}

describe('githubRepo.getGithubIssueStats', () => {
    beforeEach(async () => {
        const sqlite = setupDb()
        const {drizzle} = await import('drizzle-orm/better-sqlite3')
        const schema = await import('../src/db/schema')
        const db = drizzle(sqlite, {schema})

        setDbProvider({
            getDb: () => db,
            withTx: async (fn) => fn(db),
        })

        setRepoProvider(createMockRepoProvider(sqlite))

        sqlite.prepare(
            `INSERT INTO github_issues (id, board_id, card_id, owner, repo, direction, issue_id, issue_number, title_snapshot, url, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        ).run('m1', 'board-1', 'c1', 'acme', 'repo', 'imported', '1', 1, 't1', 'u1', 'open')
        sqlite.prepare(
            `INSERT INTO github_issues (id, board_id, card_id, owner, repo, direction, issue_id, issue_number, title_snapshot, url, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        ).run('m2', 'board-1', 'c2', 'acme', 'repo', 'imported', '2', 2, 't2', 'u2', 'open')
        sqlite.prepare(
            `INSERT INTO github_issues (id, board_id, card_id, owner, repo, direction, issue_id, issue_number, title_snapshot, url, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        ).run('m3', 'board-1', 'c3', 'acme', 'repo', 'exported', '3', 3, 't3', 'u3', 'open')
        sqlite.prepare(
            `INSERT INTO github_issues (id, board_id, card_id, owner, repo, direction, issue_id, issue_number, title_snapshot, url, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        ).run('m4', 'board-2', 'c4', 'acme', 'repo', 'imported', '4', 4, 't4', 'u4', 'open')
    })

    it('aggregates imported/exported counts per board', async () => {
        const {getGithubIssueStats} = await import('../src/github/repo')
        const stats = await getGithubIssueStats('board-1')
        expect(stats).toEqual({imported: 2, exported: 1, total: 3})
    })
})
