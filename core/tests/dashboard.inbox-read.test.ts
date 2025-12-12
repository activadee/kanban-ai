import {beforeEach, describe, expect, it} from 'vitest'
import {setDbProvider} from '../src/db/provider'
import {attachReadStateToInbox, loadDashboardInboxReadMap, setDashboardInboxItemRead} from '../src/dashboard/inbox-read'

async function createTestDb() {
    const betterSqlite = await import('better-sqlite3')
    const DatabaseCtor: any = (betterSqlite as any).default ?? (betterSqlite as any)
    const sqlite = new DatabaseCtor(':memory:')
    sqlite.exec(`
        CREATE TABLE dashboard_inbox_items (
            id TEXT PRIMARY KEY,
            is_read INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `)
    const {drizzle} = await import('drizzle-orm/better-sqlite3')
    const schema = await import('../src/db/schema')
    const db = drizzle(sqlite, {schema})
    setDbProvider({
        getDb() {
            return db
        },
        async withTx(fn) {
            return fn(db)
        },
    })
    return {db, sqlite}
}

describe('dashboard/inbox read state', () => {
    beforeEach(async () => {
        await createTestDb()
    })

    it('loads and attaches read state to inbox items', async () => {
        const {sqlite} = await createTestDb()
        sqlite.prepare(`INSERT INTO dashboard_inbox_items (id, is_read) VALUES (?, 1)`).run('a1')

        const inbox = {
            review: [{id: 'a1', type: 'review', createdAt: new Date().toISOString()}] as any[],
            failed: [{id: 'b2', type: 'failed', createdAt: new Date().toISOString(), errorSummary: 'x'}] as any[],
            stuck: [],
        }

        const map = await loadDashboardInboxReadMap(inbox as any)
        expect(map.get('a1')).toBe(true)
        expect(map.get('b2')).toBeUndefined()

        const attached = attachReadStateToInbox(inbox as any, map)
        expect(attached.review[0].isRead).toBe(true)
        expect(attached.failed[0].isRead).toBe(false)
    })

    it('upserts read state for an item', async () => {
        const {sqlite} = await createTestDb()
        await setDashboardInboxItemRead('c3', true)
        const row = sqlite.prepare(`SELECT id, is_read FROM dashboard_inbox_items WHERE id = ?`).get('c3')
        expect(row.id).toBe('c3')
        expect(row.is_read).toBe(1)

        await setDashboardInboxItemRead('c3', false)
        const row2 = sqlite.prepare(`SELECT is_read FROM dashboard_inbox_items WHERE id = ?`).get('c3')
        expect(row2.is_read).toBe(0)
    })
})

