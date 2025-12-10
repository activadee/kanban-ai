import {describe, expect, it} from 'vitest'

import type {AttemptStatus} from 'shared'

import {
    classifyAttemptRow,
    isDoneColumn,
    STUCK_QUEUED_THRESHOLD_SECONDS,
    STUCK_RUNNING_THRESHOLD_SECONDS,
} from '../src/dashboard/inbox'

type TestAttemptRow = {
    attemptId: string
    projectId: string
    projectName: string | null
    cardId: string | null
    cardTitle: string | null
    ticketKey: string | null
    prUrl: string | null
    cardStatus: string | null
    agent: string
    status: AttemptStatus
    createdAt: Date | number
    updatedAt: Date | number
    startedAt: Date | number | null
    endedAt: Date | number | null
}

type TestCardState = {
    hasAnySuccess: boolean
    hasResolvedSuccess: boolean
    hasActionableItem: boolean
    hasStuckItem: boolean
}

function createCardState(overrides: Partial<TestCardState> = {}): TestCardState {
    return {
        hasAnySuccess: false,
        hasResolvedSuccess: false,
        hasActionableItem: false,
        hasStuckItem: false,
        ...overrides,
    }
}

function createAttemptRow(overrides: Partial<TestAttemptRow> = {}): TestAttemptRow {
    const createdAt = new Date('2025-01-10T10:00:00Z')
    return {
        attemptId: 'a-test',
        projectId: 'board-1',
        projectName: 'Project One',
        cardId: 'card-1',
        cardTitle: 'Card One',
        ticketKey: 'CARD-1',
        prUrl: null,
        cardStatus: 'Todo',
        agent: 'AGENT',
        status: 'succeeded',
        createdAt,
        updatedAt: createdAt,
        startedAt: createdAt,
        endedAt: createdAt,
        ...overrides,
    }
}

describe('dashboard/inbox classification helpers', () => {
    it('treats Done/closed column titles as done columns', () => {
        expect(isDoneColumn('Done')).toBe(true)
        expect(isDoneColumn(' done ')).toBe(true)
        expect(isDoneColumn('CLOSED')).toBe(true)
        expect(isDoneColumn('In Progress')).toBe(false)
        expect(isDoneColumn(null)).toBe(false)
    })

    it('classifies succeeded attempts with PRs on non-done cards as review items', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const nowMs = baseTime.getTime()
        const cardState = createCardState()

        const row = createAttemptRow({
            status: 'succeeded',
            prUrl: 'https://example.com/pr/123',
            cardStatus: 'In Progress',
        })

        const candidate = classifyAttemptRow(row, cardState, nowMs)

        expect(candidate).not.toBeNull()
        expect(candidate?.kind).toBe('review')
        expect(candidate?.status).toBe('succeeded')
        expect(candidate?.prUrl).toBe('https://example.com/pr/123')
        expect(cardState.hasAnySuccess).toBe(true)
        expect(cardState.hasResolvedSuccess).toBe(false)
        expect(cardState.hasActionableItem).toBe(true)
        expect(candidate?.reason).toContain('PR is still open or pending review')
        expect(candidate?.reason).toContain('card is not in a Done column')
    })

    it('does not create review items for succeeded attempts in done columns without PRs', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const nowMs = baseTime.getTime()
        const cardState = createCardState()

        const row = createAttemptRow({
            status: 'succeeded',
            prUrl: null,
            cardStatus: 'Done',
        })

        const candidate = classifyAttemptRow(row, cardState, nowMs)

        expect(candidate).toBeNull()
        expect(cardState.hasAnySuccess).toBe(true)
        expect(cardState.hasResolvedSuccess).toBe(true)
        expect(cardState.hasActionableItem).toBe(false)
    })

    it('creates failed inbox items when there is no prior success and the card is not done', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const nowMs = baseTime.getTime()
        const cardState = createCardState()

        const row = createAttemptRow({
            status: 'failed',
            cardStatus: 'In Progress',
            prUrl: null,
        })

        const candidate = classifyAttemptRow(row, cardState, nowMs)

        expect(candidate).not.toBeNull()
        expect(candidate?.kind).toBe('failed')
        expect(candidate?.status).toBe('failed')
        expect(cardState.hasAnySuccess).toBe(false)
        expect(cardState.hasActionableItem).toBe(true)
    })

    it('suppresses failed items once a card has any successful attempt', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const nowMs = baseTime.getTime()
        const cardState = createCardState()

        // First, a resolved success in a Done column.
        const successRow = createAttemptRow({
            status: 'succeeded',
            cardStatus: 'Done',
            prUrl: null,
        })
        const successCandidate = classifyAttemptRow(successRow, cardState, nowMs)
        expect(successCandidate).toBeNull()
        expect(cardState.hasAnySuccess).toBe(true)
        expect(cardState.hasResolvedSuccess).toBe(true)

        // Then, a later failed attempt should not produce a new inbox candidate.
        const failedRow = createAttemptRow({
            status: 'failed',
            cardStatus: 'In Progress',
        })
        const failedCandidate = classifyAttemptRow(failedRow, cardState, nowMs)
        expect(failedCandidate).toBeNull()
        expect(cardState.hasActionableItem).toBe(false)
    })

    it('does not emit stuck items until the queued threshold is reached', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const createdAt = new Date(baseTime.getTime() - (STUCK_QUEUED_THRESHOLD_SECONDS - 30) * 1000)
        const nowMs = baseTime.getTime()
        const cardState = createCardState()

        const row = createAttemptRow({
            status: 'queued',
            startedAt: createdAt,
            createdAt,
        })

        const candidate = classifyAttemptRow(row, cardState, nowMs)

        expect(candidate).toBeNull()
        expect(cardState.hasStuckItem).toBe(false)
        expect(cardState.hasActionableItem).toBe(false)
    })

    it('creates stuck items for long-running queued attempts and only once per card', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const startedAt = new Date(
            baseTime.getTime() - (STUCK_QUEUED_THRESHOLD_SECONDS + 60) * 1000,
        )
        const nowMs = baseTime.getTime()
        const cardState = createCardState()

        const firstRow = createAttemptRow({
            attemptId: 'queued-1',
            status: 'queued',
            startedAt,
            createdAt: startedAt,
        })

        const firstCandidate = classifyAttemptRow(firstRow, cardState, nowMs)
        expect(firstCandidate).not.toBeNull()
        expect(firstCandidate?.kind).toBe('stuck')
        expect(firstCandidate?.stuckForSeconds).toBeGreaterThanOrEqual(
            STUCK_QUEUED_THRESHOLD_SECONDS,
        )
        expect(cardState.hasStuckItem).toBe(true)
        expect(cardState.hasActionableItem).toBe(true)

        const secondRow = createAttemptRow({
            attemptId: 'queued-2',
            status: 'queued',
            startedAt,
            createdAt: startedAt,
        })

        const secondCandidate = classifyAttemptRow(secondRow, cardState, nowMs)
        expect(secondCandidate).toBeNull()
    })

    it('creates stuck items for running attempts after the running threshold', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const startedAt = new Date(
            baseTime.getTime() - (STUCK_RUNNING_THRESHOLD_SECONDS + 120) * 1000,
        )
        const nowMs = baseTime.getTime()
        const cardState = createCardState()

        const row = createAttemptRow({
            attemptId: 'running-1',
            status: 'running',
            startedAt,
            createdAt: startedAt,
        })

        const candidate = classifyAttemptRow(row, cardState, nowMs)

        expect(candidate).not.toBeNull()
        expect(candidate?.kind).toBe('stuck')
        expect(candidate?.stuckForSeconds).toBeGreaterThanOrEqual(
            STUCK_RUNNING_THRESHOLD_SECONDS,
        )
    })

    it('handles missing optional fields without throwing and falls back to now for invalid timestamps', () => {
        const baseTime = new Date('2025-01-10T12:00:00Z')
        const nowMs = baseTime.getTime()
        const cardState: TestCardState = {
            hasAnySuccess: false,
            hasResolvedSuccess: false,
            hasActionableItem: false,
            hasStuckItem: false,
        }

        const row: TestAttemptRow = {
            attemptId: 'a-missing',
            projectId: 'board-1',
            projectName: null,
            cardId: null,
            cardTitle: null,
            ticketKey: null,
            prUrl: null,
            cardStatus: null,
            agent: 'AGENT',
            status: 'failed',
            createdAt: Number.NaN,
            updatedAt: Number.NaN,
            startedAt: null,
            endedAt: null,
        }

        const candidate = classifyAttemptRow(row, cardState, nowMs)

        expect(candidate).not.toBeNull()
        expect(candidate?.lastUpdatedAtMs).toBe(nowMs)
    })
})

