import {eq} from 'drizzle-orm'
import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import {onboardingState} from '../db/schema'
import type {OnboardingRepo} from 'core/repos/interfaces'
import type {OnboardingStateRow} from 'core/db/types'

const SINGLETON_ID = 'singleton'

export function createOnboardingRepo(db: BunSQLiteDatabase): OnboardingRepo {
    return {
        async getOnboardingState(): Promise<OnboardingStateRow | null> {
            const [row] = await db.select().from(onboardingState).limit(1)
            return row ?? null
        },

        async upsertOnboardingState(values: Partial<OnboardingStateRow>): Promise<OnboardingStateRow> {
            await db
                .insert(onboardingState)
                .values({id: SINGLETON_ID, ...values})
                .onConflictDoUpdate({
                    target: onboardingState.id,
                    set: {...values, updatedAt: new Date()},
                })
                .run()
            const [row] = await db.select().from(onboardingState).where(eq(onboardingState.id, SINGLETON_ID)).limit(1)
            return row!
        },
    }
}
