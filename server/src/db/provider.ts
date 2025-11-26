import type {DbExecutor} from 'core'
import {setDbProvider} from 'core'
import type {DbClient} from './client'

export function registerCoreDbProvider(db: DbClient) {
    setDbProvider({
        getDb() {
            return db as unknown as DbExecutor
        },
        async withTx(fn) {
            return db.transaction(async (tx) => fn(tx as unknown as DbExecutor))
        },
    })
}
