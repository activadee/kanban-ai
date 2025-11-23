import type {OnboardingStatus} from 'shared'
import {SERVER_URL} from '@/lib/env'

async function parseStatusResponse(res: Response): Promise<OnboardingStatus> {
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to load onboarding status')
    }
    const data = (await res.json()) as { status: OnboardingStatus }
    return data.status
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
    const res = await fetch(`${SERVER_URL}/onboarding/status`)
    return parseStatusResponse(res)
}

export async function recordOnboardingProgress(step?: string): Promise<OnboardingStatus> {
    const res = await fetch(`${SERVER_URL}/onboarding/progress`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({step}),
    })
    return parseStatusResponse(res)
}

export async function completeOnboarding(step?: string): Promise<OnboardingStatus> {
    const res = await fetch(`${SERVER_URL}/onboarding/complete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({step}),
    })
    return parseStatusResponse(res)
}
