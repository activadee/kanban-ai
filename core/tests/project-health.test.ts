import {describe, expect, it} from 'vitest'

import {
    buildProjectHealth,
    PROJECT_HEALTH_ACTIVITY_ATTEMPTS_IN_RANGE_WEIGHT,
    PROJECT_HEALTH_ACTIVITY_OPEN_CARDS_WEIGHT,
    PROJECT_HEALTH_ACTIVITY_ACTIVE_ATTEMPTS_WEIGHT,
    PROJECT_HEALTH_AT_RISK_FAILURE_RATE_THRESHOLD,
    PROJECT_HEALTH_AT_RISK_MIN_ATTEMPTS,
    PROJECT_HEALTH_HIGH_ACTIVITY_SCORE_THRESHOLD,
} from '../src/dashboard/project-health'

describe('buildProjectHealth', () => {
    it('computes activityScore as a weighted sum of open cards, active attempts, and attempts in range', () => {
        const openCards = 4
        const activeAttempts = 2
        const attemptsInRange = 3

        const health = buildProjectHealth({
            openCards,
            activeAttempts,
            attemptsInRange,
            failedAttemptsInRange: 1,
        })

        const expectedScore =
            openCards * PROJECT_HEALTH_ACTIVITY_OPEN_CARDS_WEIGHT +
            activeAttempts * PROJECT_HEALTH_ACTIVITY_ACTIVE_ATTEMPTS_WEIGHT +
            attemptsInRange * PROJECT_HEALTH_ACTIVITY_ATTEMPTS_IN_RANGE_WEIGHT

        expect(health.activityScore).toBe(expectedScore)
    })

    it('computes failureRateInRange as failed / total attempts and returns 0 when there are no attempts', () => {
        const healthWithAttempts = buildProjectHealth({
            openCards: 1,
            activeAttempts: 0,
            attemptsInRange: 4,
            failedAttemptsInRange: 2,
        })

        expect(healthWithAttempts.failureRateInRange).toBeCloseTo(2 / 4, 5)

        const healthWithoutAttempts = buildProjectHealth({
            openCards: 0,
            activeAttempts: 0,
            attemptsInRange: 0,
            failedAttemptsInRange: 0,
        })

        expect(healthWithoutAttempts.failureRateInRange).toBe(0)
    })

    it('sets isHighActivity when activityScore exceeds the configured threshold', () => {
        const attemptsInRange = 3
        const health = buildProjectHealth({
            openCards: 2,
            activeAttempts: 2,
            attemptsInRange,
            failedAttemptsInRange: 0,
        })

        expect(health.activityScore).toBeGreaterThanOrEqual(
            PROJECT_HEALTH_HIGH_ACTIVITY_SCORE_THRESHOLD,
        )
        expect(health.isHighActivity).toBe(true)
    })

    it('sets isAtRisk when failure rate and sample size exceed configured thresholds', () => {
        const attemptsInRange = PROJECT_HEALTH_AT_RISK_MIN_ATTEMPTS + 1
        const failedAttemptsInRange = Math.ceil(
            attemptsInRange * PROJECT_HEALTH_AT_RISK_FAILURE_RATE_THRESHOLD,
        )

        const health = buildProjectHealth({
            openCards: 1,
            activeAttempts: 0,
            attemptsInRange,
            failedAttemptsInRange,
        })

        expect(health.failureRateInRange).toBeGreaterThanOrEqual(
            PROJECT_HEALTH_AT_RISK_FAILURE_RATE_THRESHOLD,
        )
        expect(health.isAtRisk).toBe(true)
    })

    it('produces descriptive notes for common scenarios', () => {
        const noActivity = buildProjectHealth({
            openCards: 0,
            activeAttempts: 0,
            attemptsInRange: 0,
            failedAttemptsInRange: 0,
        })
        expect(noActivity.notes).toBe('No cards or attempts in selected range')

        const openCardsNoAttempts = buildProjectHealth({
            openCards: 3,
            activeAttempts: 0,
            attemptsInRange: 0,
            failedAttemptsInRange: 0,
        })
        expect(openCardsNoAttempts.notes).toBe('Open cards with no recent attempts')
    })
})

