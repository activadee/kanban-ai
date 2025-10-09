import {db} from './client'
import type {DbExecutor} from 'core'
import {setDbProvider} from 'core'

export function registerCoreDbProvider() {
    setDbProvider({
        getDb() {
            return db as unknown as DbExecutor
        },
        async withTx(fn) {
            return db.transaction(async (tx) => fn(tx as unknown as DbExecutor))
        },
    })
}

