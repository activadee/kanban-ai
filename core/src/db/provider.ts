// Use broad typing to avoid cross-package Drizzle generic variance issues
type DbExecutor = any
type TxFn = <T>(fn: (tx: DbExecutor) => Promise<T>) => Promise<T>

export type DbProvider = {
    getDb(): DbExecutor
    withTx: TxFn
}

let provider: DbProvider | null = null

export function setDbProvider(p: DbProvider) {
    provider = p
}

export function getDb(): DbExecutor {
    if (!provider) throw new Error('[core:db] provider not set; call setDbProvider() in host')
    return provider.getDb()
}

export async function withTx<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
    if (!provider) throw new Error('[core:db] provider not set; call setDbProvider() in host')
    return provider.withTx(fn)
}

export function resolveDb(executor?: DbExecutor): DbExecutor {
    return executor ?? getDb()
}
