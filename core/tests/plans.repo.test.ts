import {beforeEach, describe, expect, it} from 'vitest'
import Database from 'better-sqlite3'
import {setDbProvider} from '../src/db/provider'

function setupDb() {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
        CREATE TABLE boards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            repository_path TEXT NOT NULL,
            repository_url TEXT,
            repository_slug TEXT,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE columns (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            position INTEGER NOT NULL,
            board_id TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE cards (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            position INTEGER NOT NULL,
            column_id TEXT NOT NULL,
            board_id TEXT,
            ticket_key TEXT,
            ticket_type TEXT,
            is_enhanced integer NOT NULL DEFAULT 0,
            pr_url TEXT,
            disable_auto_close_on_pr_merge integer NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE attempts (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            card_id TEXT NOT NULL,
            agent TEXT NOT NULL,
            status TEXT NOT NULL,
            base_branch TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            is_planning_attempt integer NOT NULL DEFAULT 0,
            worktree_path TEXT,
            session_id TEXT,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            started_at INTEGER,
            ended_at INTEGER
        );
        CREATE TABLE card_plans (
            id TEXT PRIMARY KEY NOT NULL,
            card_id TEXT NOT NULL UNIQUE,
            board_id TEXT NOT NULL,
            plan_markdown TEXT NOT NULL,
            source_message_id TEXT,
            source_attempt_id TEXT,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );
    `)
    return sqlite
}

describe('plansRepo', () => {
    beforeEach(async () => {
        const sqlite = setupDb()
        const {drizzle} = await import('drizzle-orm/better-sqlite3')
        const schema = await import('../src/db/schema')
        const db = drizzle(sqlite, {schema})

        setDbProvider({
            getDb: () => db,
            withTx: async (fn) => fn(db),
        })

        sqlite.prepare(`INSERT INTO boards (id, name, repository_path) VALUES (?, ?, ?)`).run('b1', 'board', '/tmp/repo')
        sqlite.prepare(`INSERT INTO columns (id, title, position, board_id) VALUES (?, ?, ?, ?)`).run('col1', 'Backlog', 0, 'b1')
        sqlite.prepare(`INSERT INTO cards (id, title, position, column_id, board_id) VALUES (?, ?, ?, ?, ?)`).run('c1', 'card', 0, 'col1', 'b1')
    })

    it('saves and loads a plan for a card', async () => {
        const {savePlan, getPlanForCard} = await import('../src/plans/repo')

        const saved = await savePlan('b1', 'c1', {planMarkdown: 'do the thing'})
        expect(saved.cardId).toBe('c1')
        expect(saved.boardId).toBe('b1')
        expect(saved.planMarkdown).toBe('do the thing')
        expect(saved.id.startsWith('plan-')).toBe(true)

        const loaded = await getPlanForCard('c1')
        expect(loaded?.id).toBe(saved.id)
        expect(loaded?.planMarkdown).toBe('do the thing')
    })

    it('replaces the existing plan for the same card', async () => {
        const {savePlan, getPlanForCard} = await import('../src/plans/repo')

        const first = await savePlan('b1', 'c1', {planMarkdown: 'first'})
        const second = await savePlan('b1', 'c1', {planMarkdown: 'second'})

        expect(second.id).toBe(first.id)
        const loaded = await getPlanForCard('c1')
        expect(loaded?.planMarkdown).toBe('second')
    })

    it('deletes an existing plan', async () => {
        const {savePlan, deletePlan, getPlanForCard} = await import('../src/plans/repo')

        await savePlan('b1', 'c1', {planMarkdown: 'tmp'})
        expect(await deletePlan('c1')).toBe(true)
        expect(await getPlanForCard('c1')).toBeNull()
        expect(await deletePlan('c1')).toBe(false)
    })
})

