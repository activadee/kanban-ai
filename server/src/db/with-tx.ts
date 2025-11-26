import {resolveDb as coreResolveDb, withTx as coreWithTx} from 'core'

// These aliases keep the public surface stable while delegating to the
// provider registered via core's setDbProvider().
export type DbExecutor = any
export type DbTransaction = any

export const resolveDb = (executor?: DbExecutor): DbExecutor => coreResolveDb(executor)

export async function withTx<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return coreWithTx(fn)
}
