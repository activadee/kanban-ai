import type {ProjectHealth} from 'shared'

/**
 * Input metrics used to derive project-level health signals.
 *
 * All counts are expected to be non-negative integers but the helper is
 * defensive and clamps negative values to zero.
 */
export interface ProjectHealthInput {
    openCards: number
    activeAttempts: number
    attemptsInRange: number
    failedAttemptsInRange: number
}

/**
 * Weight assigned to each open card when computing `activityScore`.
 */
export const PROJECT_HEALTH_ACTIVITY_OPEN_CARDS_WEIGHT = 1

/**
 * Weight assigned to each active attempt when computing `activityScore`.
 */
export const PROJECT_HEALTH_ACTIVITY_ACTIVE_ATTEMPTS_WEIGHT = 3

/**
 * Weight assigned to each attempt in range when computing `activityScore`.
 */
export const PROJECT_HEALTH_ACTIVITY_ATTEMPTS_IN_RANGE_WEIGHT = 2

/**
 * Minimum `activityScore` required for a project to be considered
 * high-activity.
 */
export const PROJECT_HEALTH_HIGH_ACTIVITY_SCORE_THRESHOLD = 10

/**
 * Minimum number of open cards that contributes to the high-activity flag.
 */
export const PROJECT_HEALTH_HIGH_ACTIVITY_MIN_OPEN_CARDS = 1

/**
 * Minimum number of attempts in range that contributes to the high-activity
 * flag.
 */
export const PROJECT_HEALTH_HIGH_ACTIVITY_MIN_ATTEMPTS_IN_RANGE = 1

/**
 * Failure rate threshold (0–1) above which a project is considered at risk,
 * provided there is sufficient attempt volume.
 */
export const PROJECT_HEALTH_AT_RISK_FAILURE_RATE_THRESHOLD = 0.5

/**
 * Minimum number of attempts in range required before we trust failure-rate
 * based risk signals.
 */
export const PROJECT_HEALTH_AT_RISK_MIN_ATTEMPTS = 5

/**
 * Compute derived health signals for a single project/board.
 *
 * The scoring model is intentionally simple and deterministic:
 *
 * - `activityScore = openCards * 1 + activeAttempts * 3 + attemptsInRange * 2`
 * - `failureRateInRange = failedAttemptsInRange / attemptsInRange` when
 *   `attemptsInRange > 0`, otherwise `0`.
 * - `isHighActivity` when `activityScore` exceeds
 *   `PROJECT_HEALTH_HIGH_ACTIVITY_SCORE_THRESHOLD` and there is at least one
 *   open card or in-range attempt.
 * - `isAtRisk` when `failureRateInRange` exceeds
 *   `PROJECT_HEALTH_AT_RISK_FAILURE_RATE_THRESHOLD` and
 *   `attemptsInRange >= PROJECT_HEALTH_AT_RISK_MIN_ATTEMPTS`.
 */
export function buildProjectHealth(input: ProjectHealthInput): ProjectHealth {
    const openCards = Math.max(0, input.openCards)
    const activeAttempts = Math.max(0, input.activeAttempts)
    const attemptsInRange = Math.max(0, input.attemptsInRange)
    const failedAttemptsInRange = Math.max(0, input.failedAttemptsInRange)

    const activityScore =
        openCards * PROJECT_HEALTH_ACTIVITY_OPEN_CARDS_WEIGHT +
        activeAttempts * PROJECT_HEALTH_ACTIVITY_ACTIVE_ATTEMPTS_WEIGHT +
        attemptsInRange * PROJECT_HEALTH_ACTIVITY_ATTEMPTS_IN_RANGE_WEIGHT

    const failureRateInRange =
        attemptsInRange > 0 ? failedAttemptsInRange / attemptsInRange : 0

    const hasMeaningfulActivity =
        openCards >= PROJECT_HEALTH_HIGH_ACTIVITY_MIN_OPEN_CARDS ||
        attemptsInRange >= PROJECT_HEALTH_HIGH_ACTIVITY_MIN_ATTEMPTS_IN_RANGE

    const isHighActivity =
        activityScore >= PROJECT_HEALTH_HIGH_ACTIVITY_SCORE_THRESHOLD &&
        hasMeaningfulActivity

    const isAtRisk =
        attemptsInRange >= PROJECT_HEALTH_AT_RISK_MIN_ATTEMPTS &&
        failureRateInRange >= PROJECT_HEALTH_AT_RISK_FAILURE_RATE_THRESHOLD

    let notes: string | undefined
    if (attemptsInRange === 0 && openCards === 0) {
        notes = 'No cards or attempts in selected range'
    } else if (attemptsInRange === 0 && openCards > 0) {
        notes = 'Open cards with no recent attempts'
    } else if (isAtRisk) {
        notes = 'High failure rate with sufficient recent attempts'
    } else if (isHighActivity) {
        notes = 'High activity with multiple open cards and attempts'
    } else {
        notes = 'Moderate activity and low failure rate'
    }

    return {
        activityScore,
        failureRateInRange,
        isHighActivity,
        isAtRisk,
        notes,
    }
}

