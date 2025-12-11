import type {ProjectSnapshot} from 'shared'

export type ProjectHealthSortKey = 'openCards' | 'failedAttemptsInRange'

export const HIGH_ACTIVITY_ATTEMPT_THRESHOLD = 5
export const HIGH_ACTIVITY_OPEN_CARDS_THRESHOLD = 10
export const MIN_ATTEMPTS_FOR_FAILURE_EVAL = 5
export const HIGH_FAILURE_RATE_RATIO = 0.5

function getOpenCardsCount(snapshot: ProjectSnapshot): number {
    return snapshot.openCards ?? 0
}

function getTotalCardsCount(snapshot: ProjectSnapshot): number {
    return snapshot.totalCards ?? 0
}

function getActiveAttemptsCount(snapshot: ProjectSnapshot): number {
    if (typeof snapshot.activeAttemptsCount === 'number') {
        return snapshot.activeAttemptsCount
    }
    if (typeof snapshot.activeAttempts === 'number') {
        return snapshot.activeAttempts
    }
    return 0
}

function getAttemptsInRange(snapshot: ProjectSnapshot): number {
    return snapshot.attemptsInRange ?? 0
}

function getFailedAttemptsInRange(snapshot: ProjectSnapshot): number {
    return snapshot.failedAttemptsInRange ?? 0
}

export function getFailureRate(snapshot: ProjectSnapshot): number | null {
    const attemptsInRange = getAttemptsInRange(snapshot)
    if (attemptsInRange <= 0) return null

    if (typeof snapshot.failureRateInRange === 'number') {
        return snapshot.failureRateInRange
    }

    const failedAttemptsInRange = getFailedAttemptsInRange(snapshot)
    return failedAttemptsInRange / attemptsInRange
}

export function isHighActivity(snapshot: ProjectSnapshot): boolean {
    if (snapshot.health && typeof snapshot.health.isHighActivity === 'boolean') {
        return snapshot.health.isHighActivity
    }

    const attemptsInRange = getAttemptsInRange(snapshot)
    const openCards = getOpenCardsCount(snapshot)

    return (
        attemptsInRange >= HIGH_ACTIVITY_ATTEMPT_THRESHOLD ||
        openCards >= HIGH_ACTIVITY_OPEN_CARDS_THRESHOLD
    )
}

export function isHighFailureRate(snapshot: ProjectSnapshot): boolean {
    if (snapshot.health && typeof snapshot.health.isAtRisk === 'boolean') {
        return snapshot.health.isAtRisk
    }

    const attemptsInRange = getAttemptsInRange(snapshot)
    if (attemptsInRange < MIN_ATTEMPTS_FOR_FAILURE_EVAL) {
        return false
    }

    const failureRate = getFailureRate(snapshot)
    if (failureRate == null) return false

    return failureRate >= HIGH_FAILURE_RATE_RATIO
}

export function sortProjectSnapshots(
    snapshots: ProjectSnapshot[],
    sortKey: ProjectHealthSortKey,
): ProjectSnapshot[] {
    const items = [...snapshots]

    items.sort((a, b) => {
        let aValue = 0
        let bValue = 0

        if (sortKey === 'openCards') {
            aValue = getOpenCardsCount(a)
            bValue = getOpenCardsCount(b)
        } else if (sortKey === 'failedAttemptsInRange') {
            aValue = getFailedAttemptsInRange(a)
            bValue = getFailedAttemptsInRange(b)
        }

        if (aValue !== bValue) {
            return bValue - aValue
        }

        return a.name.localeCompare(b.name)
    })

    return items
}

export function resolveProjectMetrics(snapshot: ProjectSnapshot): {
    openCards: number
    totalCards: number
    activeAttempts: number
    attemptsInRange: number
    failedAttemptsInRange: number
    failureRate: number | null
} {
    const openCards = getOpenCardsCount(snapshot)
    const totalCards = getTotalCardsCount(snapshot)
    const activeAttempts = getActiveAttemptsCount(snapshot)
    const attemptsInRange = getAttemptsInRange(snapshot)
    const failedAttemptsInRange = getFailedAttemptsInRange(snapshot)
    const failureRate = getFailureRate(snapshot)

    return {
        openCards,
        totalCards,
        activeAttempts,
        attemptsInRange,
        failedAttemptsInRange,
        failureRate,
    }
}

