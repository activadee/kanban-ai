import {beforeEach, describe, expect, it, vi} from 'vitest'

describe('db/provider', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('throws when provider is not set', async () => {
        const mod = await import('../src/db/provider')
        expect(() => mod.getDb()).toThrowError('[core:db] provider not set; call setDbProvider() in host')
        await expect(mod.withTx(async () => 'noop')).rejects.toThrowError(
            '[core:db] provider not set; call setDbProvider() in host',
        )
    })

    it('uses injected provider for db access and transactions', async () => {
        const mod = await import('../src/db/provider')
        const txSpy = vi.fn(async (fn: (tx: string) => Promise<number>) => fn('tx-db'))

        mod.setDbProvider({
            getDb: () => 'db-instance',
            withTx: txSpy,
        })

        expect(mod.getDb()).toBe('db-instance')

        const result = await mod.withTx(async (tx) => {
            expect(tx).toBe('tx-db')
            return 7
        })
        expect(result).toBe(7)
        expect(txSpy).toHaveBeenCalledTimes(1)

        expect(mod.resolveDb('custom-db')).toBe('custom-db')
        expect(mod.resolveDb()).toBe('db-instance')
    })
})

