import {getOnboardingRepo} from '../repos/provider'
import type {OnboardingStateRow} from '../db/types'

export async function getOnboardingState(): Promise<OnboardingStateRow | null> {
    return getOnboardingRepo().getOnboardingState()
}

export async function upsertOnboardingState(values: Partial<OnboardingStateRow>): Promise<OnboardingStateRow> {
    return getOnboardingRepo().upsertOnboardingState(values)
}
