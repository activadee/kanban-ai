import {and, desc, eq, gte, inArray, lt, sql} from 'drizzle-orm'
import type {DashboardInbox, InboxItemType, AttemptStatus} from 'shared'
import {attempts, boards, cards, columns} from '../db/schema'
import {resolveDb} from '../db/with-tx'
import {listAttemptLogs} from '../attempts/repo'

type AttemptRowForInbox = {
    attemptId: string
    projectId: string
    projectName: string | null
    cardId: string | null
    cardTitle: string | null
    ticketKey: string | null
    prUrl: string | null
    cardStatus: string | null
    agent: string
    status: string
    createdAt: Date | number
    updatedAt: Date | number
    startedAt: Date | number | null
    endedAt: Date | number | null
}

type CardAggregationState = {
    hasAnySuccess: boolean
    hasResolvedSuccess: boolean
    hasActionableItem: boolean
    hasStuckItem: boolean
}

type InboxCandidateBase = {
    kind: InboxItemType
    attemptId: string
    projectId: string
    projectName: string | null
    cardId: string | null
    cardTitle: string | null
    ticketKey: string | null
    prUrl: string | null
    cardStatus: string | null
    agentId: string
    status: AttemptStatus
    createdAtIso: string
    finishedAtIso: string | null
    lastUpdatedAtIso: string | null
    lastUpdatedAtMs: number
}

type ReviewCandidate = InboxCandidateBase & {
    kind: 'review'
    reason?: string
}

type FailedCandidate = InboxCandidateBase & {
    kind: 'failed'
    errorSummary?: string
}

type StuckCandidate = InboxCandidateBase & {
    kind: 'stuck'
    stuckForSeconds: number
}

type InboxCandidate = ReviewCandidate | FailedCandidate | StuckCandidate

const INBOX_DEFAULT_LIMIT = 25
const INBOX_MAX_LIMIT = 100
const INBOX_MAX_SCANNED_ATTEMPTS = 500

const STUCK_QUEUED_THRESHOLD_SECONDS = 10 * 60
const STUCK_RUNNING_THRESHOLD_SECONDS = 30 * 60

const INBOX_RELEVANT_STATUSES: AttemptStatus[] = [
    'queued',
    'running',
    'stopping',
    'succeeded',
    'failed',
    'stopped',
]

function toIso(value: Date | number | null): string | null {
    if (value == null) return null
    const date = value instanceof Date ? value : new Date(value)
    const time = date.getTime()
    if (!Number.isFinite(time) || Number.isNaN(time)) return null
    return date.toISOString()
}

function normalizeTitle(id: string | null, raw: string | null, fallbackLabel: string): string {
    const trimmed = raw?.trim()
    if (trimmed && trimmed.length > 0) return trimmed
    if (id) return `${fallbackLabel} ${id}`
    return `Unknown ${fallbackLabel.toLowerCase()}`
}

function isDoneColumn(cardStatus: string | null): boolean {
    const value = cardStatus?.trim().toLowerCase()
    if (!value) return false
    return value === 'done' || value === 'closed'
}

function classifyAttemptRow(
    row: AttemptRowForInbox,
    cardState: CardAggregationState,
    nowMs: number,
): InboxCandidate | null {
    const status = row.status as AttemptStatus
    const isSuccess = status === 'succeeded'
    const isFailed = status === 'failed' || status === 'stopped'
    const isQueued = status === 'queued'
    const isRunning = status === 'running' || status === 'stopping'

    const createdAtIso = toIso(row.createdAt) ?? new Date(nowMs).toISOString()
    const updatedAtIso = toIso(row.updatedAt) ?? createdAtIso
    const finishedAtIso = toIso(row.endedAt)

    const lastUpdatedIso = finishedAtIso ?? updatedAtIso ?? createdAtIso
    const lastUpdatedMs = (() => {
        const date = new Date(lastUpdatedIso)
        const time = date.getTime()
        return Number.isFinite(time) && !Number.isNaN(time) ? time : nowMs
    })()

    const doneColumn = isDoneColumn(row.cardStatus)
    const hasReviewSignal = isSuccess && (Boolean(row.prUrl) || !doneColumn)

    if (isSuccess) {
        cardState.hasAnySuccess = true
        if (!hasReviewSignal) {
            cardState.hasResolvedSuccess = true
        }
    }
    if (cardState.hasActionableItem && !(isQueued || isRunning)) {
        return null
    }

    if (isSuccess && hasReviewSignal && !cardState.hasResolvedSuccess) {
        const reasonParts: string[] = []
        if (row.prUrl) reasonParts.push('PR is still open or pending review')
        if (!doneColumn) reasonParts.push('card is not in a Done column')
        const reason = reasonParts.length > 0 ? reasonParts.join('; ') : undefined

        cardState.hasActionableItem = true
        return {
            kind: 'review',
            reason,
            attemptId: row.attemptId,
            projectId: row.projectId,
            projectName: row.projectName,
            cardId: row.cardId,
            cardTitle: row.cardTitle,
            ticketKey: row.ticketKey,
            prUrl: row.prUrl,
            cardStatus: row.cardStatus,
            agentId: row.agent,
            status,
            createdAtIso,
            finishedAtIso,
            lastUpdatedAtIso: lastUpdatedIso,
            lastUpdatedAtMs: lastUpdatedMs,
        }
    }

    if (isFailed && !cardState.hasAnySuccess && !doneColumn) {
        cardState.hasActionableItem = true
        return {
            kind: 'failed',
            attemptId: row.attemptId,
            projectId: row.projectId,
            projectName: row.projectName,
            cardId: row.cardId,
            cardTitle: row.cardTitle,
            ticketKey: row.ticketKey,
            prUrl: row.prUrl,
            cardStatus: row.cardStatus,
            agentId: row.agent,
            status,
            createdAtIso,
            finishedAtIso,
            lastUpdatedAtIso: lastUpdatedIso,
            lastUpdatedAtMs: lastUpdatedMs,
        }
    }

    if (isQueued || isRunning) {
        const startedSource = row.startedAt ?? row.createdAt
        const startedIso = toIso(startedSource)
        if (startedIso) {
            const startedMs = new Date(startedIso).getTime()
            if (Number.isFinite(startedMs) && !Number.isNaN(startedMs)) {
                const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000))
                const thresholdSeconds = isQueued
                    ? STUCK_QUEUED_THRESHOLD_SECONDS
                    : STUCK_RUNNING_THRESHOLD_SECONDS
                if (elapsedSeconds >= thresholdSeconds) {
                    if (cardState.hasStuckItem) return null
                    cardState.hasActionableItem = true
                    cardState.hasStuckItem = true
                    return {
                        kind: 'stuck',
                        stuckForSeconds: elapsedSeconds,
                        attemptId: row.attemptId,
                        projectId: row.projectId,
                        projectName: row.projectName,
                        cardId: row.cardId,
                        cardTitle: row.cardTitle,
                        ticketKey: row.ticketKey,
                        prUrl: row.prUrl,
                        cardStatus: row.cardStatus,
                        agentId: row.agent,
                        status,
                        createdAtIso,
                        finishedAtIso: null,
                        lastUpdatedAtIso: lastUpdatedIso,
                        lastUpdatedAtMs: lastUpdatedMs,
                    }
                }
            }
        }
    }

    return null
}

function truncateSummary(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 1)}…`
}

async function enrichFailedCandidatesWithErrors(candidates: FailedCandidate[]): Promise<void> {
    const tasks = candidates.map(async (candidate) => {
        try {
            const logs = await listAttemptLogs(candidate.attemptId)
            if (!Array.isArray(logs) || logs.length === 0) {
                candidate.errorSummary = 'Attempt failed – see logs for details'
                return
            }
            const fallbackLog = logs[logs.length - 1]
            const errorLog =
                [...logs].reverse().find((log) => log.level.toLowerCase() === 'error') ||
                fallbackLog
            const message = (errorLog && errorLog.message?.toString()) || 'Attempt failed'
            const normalized = message.replace(/\s+/g, ' ').trim()
            const summary =
                normalized.length > 0 ? normalized : 'Attempt failed – see logs for details'
            candidate.errorSummary = truncateSummary(summary, 200)
        } catch {
            candidate.errorSummary = 'Attempt failed – see logs for details'
        }
    })
    await Promise.all(tasks)
}

export async function buildDashboardInbox(
    rangeFrom: Date | null,
    rangeTo: Date | null,
): Promise<DashboardInbox> {
    const db = resolveDb()
    const nowRef = rangeTo ?? new Date()
    const nowMs = nowRef.getTime()

    const wherePredicates = [
        inArray(attempts.status, INBOX_RELEVANT_STATUSES),
        eq(attempts.isPlanningAttempt, false),
    ]

    if (rangeFrom) {
        wherePredicates.push(gte(attempts.createdAt, rangeFrom))
    }
    if (rangeTo) {
        wherePredicates.push(lt(attempts.createdAt, rangeTo))
    }

    const attemptRows = await db
        .select({
            attemptId: attempts.id,
            projectId: attempts.boardId,
            projectName: boards.name,
            cardId: attempts.cardId,
            cardTitle: cards.title,
            ticketKey: cards.ticketKey,
            prUrl: cards.prUrl,
            cardStatus: columns.title,
            agent: attempts.agent,
            status: attempts.status,
            createdAt: attempts.createdAt,
            updatedAt: attempts.updatedAt,
            startedAt: attempts.startedAt,
            endedAt: attempts.endedAt,
        })
        .from(attempts)
        .leftJoin(cards, eq(attempts.cardId, cards.id))
        .leftJoin(columns, eq(cards.columnId, columns.id))
        .leftJoin(boards, eq(attempts.boardId, boards.id))
        .where(and(...wherePredicates))
        .orderBy(desc(sql`coalesce(${attempts.endedAt}, ${attempts.updatedAt}, ${attempts.createdAt})`))
        .limit(INBOX_MAX_SCANNED_ATTEMPTS)

    const cardState = new Map<string, CardAggregationState>()
    const candidates: InboxCandidate[] = []

    for (const row of attemptRows as AttemptRowForInbox[]) {
        const cardId = row.cardId ?? `card-${row.projectId ?? 'unknown'}`
        const state =
            cardState.get(cardId) ??
            {
                hasAnySuccess: false,
                hasResolvedSuccess: false,
                hasActionableItem: false,
                hasStuckItem: false,
            }

        const candidate = classifyAttemptRow(row, state, nowMs)
        cardState.set(cardId, state)
        if (candidate) {
            candidates.push(candidate)
        }
    }

    if (candidates.length === 0) {
        return {
            review: [],
            failed: [],
            stuck: [],
        }
    }

    candidates.sort((a, b) => b.lastUpdatedAtMs - a.lastUpdatedAtMs)

    const limitedCandidates = candidates.slice(0, INBOX_DEFAULT_LIMIT)

    const failedCandidates = limitedCandidates.filter(
        (candidate): candidate is FailedCandidate => candidate.kind === 'failed',
    )
    if (failedCandidates.length > 0) {
        await enrichFailedCandidatesWithErrors(failedCandidates)
    }

    const reviewItems = limitedCandidates
        .filter((candidate): candidate is ReviewCandidate => candidate.kind === 'review')
        .map((candidate) => {
            const projectName = candidate.projectName
            const cardTitle = normalizeTitle(candidate.cardId ?? null, candidate.cardTitle, 'Card')
            const agentName = candidate.agentId
            return {
                id: candidate.attemptId,
                type: 'review' as const,
                kind: 'review' as const,
                attemptId: candidate.attemptId,
                projectId: candidate.projectId,
                projectName,
                cardId: candidate.cardId ?? undefined,
                cardTitle,
                ticketKey: candidate.ticketKey,
                agentId: candidate.agentId,
                agentName,
                status: candidate.status,
                cardStatus: candidate.cardStatus,
                createdAt: candidate.createdAtIso,
                updatedAt: candidate.lastUpdatedAtIso ?? undefined,
                finishedAt: candidate.finishedAtIso,
                lastUpdatedAt: candidate.lastUpdatedAtIso,
                prUrl: candidate.prUrl,
                reason: candidate.reason,
                meta: {},
            }
        })

    const failedItems = limitedCandidates
        .filter((candidate): candidate is FailedCandidate => candidate.kind === 'failed')
        .map((candidate) => {
            const projectName = candidate.projectName
            const cardTitle = normalizeTitle(candidate.cardId ?? null, candidate.cardTitle, 'Card')
            const agentName = candidate.agentId
            const errorSummary =
                candidate.errorSummary ?? 'Attempt failed – see logs for details'
            return {
                id: candidate.attemptId,
                type: 'failed' as const,
                kind: 'failed' as const,
                attemptId: candidate.attemptId,
                projectId: candidate.projectId,
                projectName,
                cardId: candidate.cardId ?? undefined,
                cardTitle,
                ticketKey: candidate.ticketKey,
                agentId: candidate.agentId,
                agentName,
                status: candidate.status,
                cardStatus: candidate.cardStatus,
                createdAt: candidate.createdAtIso,
                updatedAt: candidate.lastUpdatedAtIso ?? undefined,
                finishedAt: candidate.finishedAtIso,
                lastUpdatedAt: candidate.lastUpdatedAtIso,
                prUrl: candidate.prUrl,
                errorSummary,
                meta: {},
            }
        })

    const stuckItems = limitedCandidates
        .filter((candidate): candidate is StuckCandidate => candidate.kind === 'stuck')
        .map((candidate) => {
            const projectName = candidate.projectName
            const cardTitle = normalizeTitle(candidate.cardId ?? null, candidate.cardTitle, 'Card')
            const agentName = candidate.agentId
            return {
                id: candidate.attemptId,
                type: 'stuck' as const,
                kind: 'stuck' as const,
                attemptId: candidate.attemptId,
                projectId: candidate.projectId,
                projectName,
                cardId: candidate.cardId ?? undefined,
                cardTitle,
                ticketKey: candidate.ticketKey,
                agentId: candidate.agentId,
                agentName,
                status: candidate.status,
                cardStatus: candidate.cardStatus,
                createdAt: candidate.createdAtIso,
                updatedAt: candidate.lastUpdatedAtIso ?? undefined,
                finishedAt: candidate.finishedAtIso,
                lastUpdatedAt: candidate.lastUpdatedAtIso,
                prUrl: candidate.prUrl,
                stuckForSeconds: candidate.stuckForSeconds,
                meta: {},
            }
        })

    return {
        review: reviewItems,
        failed: failedItems,
        stuck: stuckItems,
        meta: {
            totalItems: limitedCandidates.length,
            totalReview: reviewItems.length,
            totalFailed: failedItems.length,
            totalStuck: stuckItems.length,
        },
    }
}

// Test-only exports to make the inbox classification logic easier to exercise
// in isolation without coupling tests to the database layer.
export {
    classifyAttemptRow,
    isDoneColumn,
    STUCK_QUEUED_THRESHOLD_SECONDS,
    STUCK_RUNNING_THRESHOLD_SECONDS,
}
