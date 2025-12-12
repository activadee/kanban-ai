import {beforeEach, describe, expect, it} from 'vitest'
import Database from 'better-sqlite3'
import {setDbProvider} from '../src/db/provider'

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

