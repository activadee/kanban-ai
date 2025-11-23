import {eq} from 'drizzle-orm'
import {onboardingState, type OnboardingStateRow} from '../db/schema'
import type {DbExecutor} from '../db/with-tx'
import {resolveDb} from '../db/with-tx'

const SINGLETON_ID = 'singleton'

export async function getOnboardingState(executor?: DbExecutor): Promise<OnboardingStateRow | null> {
    const database = resolveDb(executor)
    const [row] = await database.select().from(onboardingState).where(eq(onboardingState.id, SINGLETON_ID)).limit(1)
    return row ?? null
}

export async function upsertOnboardingState(values: Partial<OnboardingStateRow>, executor?: DbExecutor): Promise<OnboardingStateRow> {
    const database = resolveDb(executor)
    const now = new Date()
    await database
        .insert(onboardingState)
        .values({
            id: SINGLETON_ID,
            status: values.status ?? 'pending',
            lastStep: values.lastStep ?? null,
            completedAt: values.completedAt ?? null,
            createdAt: values.createdAt ?? now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: onboardingState.id,
            set: {
                status: values.status ?? onboardingState.status,
                lastStep: values.lastStep ?? onboardingState.lastStep,
                completedAt: values.completedAt ?? onboardingState.completedAt,
                updatedAt: now,
            },
        })
        .run()

    const row = await getOnboardingState(database)
    if (!row) throw new Error('Failed to persist onboarding state')
    return row
}
