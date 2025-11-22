import type {OnboardingStatus} from 'shared'
import {getOnboardingState, upsertOnboardingState} from './repo'

function toIso(value: Date | number | null | undefined): string | null {
    if (!value) return null
    const d = value instanceof Date ? value : new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function defaultStatus(): OnboardingStatus {
    return {
        status: 'pending',
        lastStep: null,
        startedAt: null,
        completedAt: null,
    }
}

function map(row: Awaited<ReturnType<typeof getOnboardingState>>): OnboardingStatus {
    if (!row) return defaultStatus()
    return {
        status: row.status === 'completed' ? 'completed' : 'pending',
        lastStep: row.lastStep ?? null,
        startedAt: toIso(row.createdAt),
        completedAt: toIso(row.completedAt),
    }
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
    const row = await getOnboardingState()
    return map(row)
}

export async function recordOnboardingProgress(step?: string): Promise<OnboardingStatus> {
    // Do not regress a completed onboarding back to pending (can happen if a
    // late progress update resolves after the completion call).
    const existing = await getOnboardingState()
    if (existing?.status === 'completed') {
        return map(existing)
    }

    const row = await upsertOnboardingState({
        status: 'pending',
        lastStep: step ?? existing?.lastStep ?? null,
    })
    return map(row)
}

export async function completeOnboarding(step?: string): Promise<OnboardingStatus> {
    const now = new Date()
    const row = await upsertOnboardingState({
        status: 'completed',
        lastStep: step ?? 'completed',
        completedAt: now,
    })
    return map(row)
}

export const onboardingService = {
    getStatus: getOnboardingStatus,
    record: recordOnboardingProgress,
    complete: completeOnboarding,
}
