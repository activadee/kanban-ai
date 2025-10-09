import type {AttemptStatus} from './runner'

export type DashboardMetrics = {
    totalProjects: number
    activeAttempts: number
    attemptsLast24h: number
    openCards: number
}

export type DashboardAttemptSummary = {
    attemptId: string
    projectId: string | null
    projectName: string | null
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    agent: string
    status: AttemptStatus
    startedAt: string | null
    updatedAt: string | null
}

export type DashboardAttemptActivity = {
    attemptId: string
    projectId: string | null
    projectName: string | null
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    agent: string
    status: AttemptStatus
    finishedAt: string | null
}

export type DashboardProjectSnapshot = {
    id: string
    name: string
    repositorySlug: string | null
    repositoryPath: string
    createdAt: string
    activeAttempts: number
    openCards: number
    totalCards: number
}

export type DashboardOverview = {
    metrics: DashboardMetrics
    activeAttempts: DashboardAttemptSummary[]
    recentAttemptActivity: DashboardAttemptActivity[]
    projectSnapshots: DashboardProjectSnapshot[]
    updatedAt: string
}
