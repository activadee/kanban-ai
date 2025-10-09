import {db, type DbClient} from './client'

export type DbTransaction = Parameters<DbClient['transaction']>[0] extends (tx: infer Tx, ...args: any[]) => any ? Tx : never
export type DbExecutor = DbClient | DbTransaction

export function resolveDb(executor?: DbExecutor): DbExecutor {
    return executor ?? db
}

export async function withTx<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => fn(tx as DbTransaction))
}
