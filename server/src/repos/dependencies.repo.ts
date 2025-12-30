import {eq, inArray} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {cardDependencies} from '../db/schema'
import type {DependenciesRepo} from 'core/repos/interfaces'

export function createDependenciesRepo(db: BunSQLiteDatabase): DependenciesRepo {
    return {
        async listDependencies(cardId: string): Promise<string[]> {
            const rows = await db
                .select({dependsOnCardId: cardDependencies.dependsOnCardId})
                .from(cardDependencies)
                .where(eq(cardDependencies.cardId, cardId))
            return rows.map((r) => r.dependsOnCardId)
        },

        async listDependenciesForCards(cardIds: string[]): Promise<Map<string, string[]>> {
            if (cardIds.length === 0) return new Map()
            const rows = await db
                .select({cardId: cardDependencies.cardId, dependsOnCardId: cardDependencies.dependsOnCardId})
                .from(cardDependencies)
                .where(inArray(cardDependencies.cardId, cardIds))
            const result = new Map<string, string[]>()
            for (const row of rows) {
                const existing = result.get(row.cardId) ?? []
                existing.push(row.dependsOnCardId)
                result.set(row.cardId, existing)
            }
            return result
        },

        async deleteDependencies(cardId: string): Promise<void> {
            await db.delete(cardDependencies).where(eq(cardDependencies.cardId, cardId)).run()
        },

        async insertDependencies(cardId: string, dependsOnIds: string[]): Promise<void> {
            if (dependsOnIds.length === 0) return
            const values = dependsOnIds.map((dependsOnCardId) => ({cardId, dependsOnCardId}))
            await db.insert(cardDependencies).values(values).run()
        },
    }
}
