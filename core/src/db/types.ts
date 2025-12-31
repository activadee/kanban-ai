/**
 * Pure TypeScript row types for database tables.
 * These types are Drizzle-agnostic and can be used across the codebase.
 * The actual Drizzle schema definitions live in server/src/db/schema/.
 */

import type {TicketType} from 'shared'

export interface BoardRow {
    id: string
    name: string
    repositoryPath: string
    repositoryUrl: string | null
    repositorySlug: string | null
    createdAt: Date
    updatedAt: Date
}

export interface BoardInsert {
    id: string
    name: string
    repositoryPath: string
    repositoryUrl?: string | null
    repositorySlug?: string | null
    createdAt?: Date
    updatedAt?: Date
}

export interface ProjectSettingsRow {
    projectId: string
    baseBranch: string
    preferredRemote: string | null
    setupScript: string | null
    devScript: string | null
    cleanupScript: string | null
    copyFiles: string | null
    allowScriptsToFail: boolean
    allowCopyFilesToFail: boolean
    allowSetupScriptToFail: boolean
    allowDevScriptToFail: boolean
    allowCleanupScriptToFail: boolean
    defaultAgent: string | null
    defaultProfileId: string | null
    inlineAgent: string | null
    inlineProfileId: string | null
    inlineAgentProfileMappingJson: string | null
    autoCommitOnFinish: boolean
    autoPushOnAutocommit: boolean
    ticketPrefix: string
    nextTicketNumber: number
    githubIssueSyncEnabled: boolean
    githubIssueSyncState: string
    githubIssueSyncIntervalMinutes: number
    githubIssueAutoCreateEnabled: boolean
    autoCloseTicketOnPRMerge: boolean
    lastGithubPrAutoCloseAt: Date | null
    lastGithubPrAutoCloseStatus: string
    lastGithubIssueSyncAt: Date | null
    lastGithubIssueSyncStatus: string
    createdAt: Date
    updatedAt: Date
}

export interface ProjectSettingsInsert {
    projectId: string
    baseBranch?: string
    preferredRemote?: string | null
    setupScript?: string | null
    devScript?: string | null
    cleanupScript?: string | null
    copyFiles?: string | null
    allowScriptsToFail?: boolean
    allowCopyFilesToFail?: boolean
    allowSetupScriptToFail?: boolean
    allowDevScriptToFail?: boolean
    allowCleanupScriptToFail?: boolean
    defaultAgent?: string | null
    defaultProfileId?: string | null
    inlineAgent?: string | null
    inlineProfileId?: string | null
    inlineAgentProfileMappingJson?: string | null
    autoCommitOnFinish?: boolean
    autoPushOnAutocommit?: boolean
    ticketPrefix?: string
    nextTicketNumber?: number
    githubIssueSyncEnabled?: boolean
    githubIssueSyncState?: string
    githubIssueSyncIntervalMinutes?: number
    githubIssueAutoCreateEnabled?: boolean
    autoCloseTicketOnPRMerge?: boolean
    lastGithubPrAutoCloseAt?: Date | null
    lastGithubPrAutoCloseStatus?: string
    lastGithubIssueSyncAt?: Date | null
    lastGithubIssueSyncStatus?: string
    createdAt?: Date
    updatedAt?: Date
}

export interface ColumnRow {
    id: string
    title: string
    order: number
    boardId: string
    createdAt: Date
    updatedAt: Date
}

export interface ColumnInsert {
    id: string
    title: string
    order: number
    boardId: string
    createdAt?: Date
    updatedAt?: Date
}

export interface CardRow {
    id: string
    title: string
    description: string | null
    order: number
    columnId: string
    boardId: string | null
    ticketKey: string | null
    ticketType: TicketType | null
    isEnhanced: boolean
    prUrl: string | null
    disableAutoCloseOnPRMerge: boolean
    createdAt: Date
    updatedAt: Date
}

export interface CardInsert {
    id: string
    title: string
    description?: string | null
    order: number
    columnId: string
    boardId?: string | null
    ticketKey?: string | null
    ticketType?: TicketType | null
    isEnhanced?: boolean
    prUrl?: string | null
    disableAutoCloseOnPRMerge?: boolean
    createdAt?: Date
    updatedAt?: Date
}

export interface AttemptRow {
    id: string
    boardId: string
    cardId: string
    agent: string
    status: string
    baseBranch: string
    branchName: string
    worktreePath: string | null
    sessionId: string | null
    createdAt: Date
    updatedAt: Date
    startedAt: Date | null
    endedAt: Date | null
}

export interface AttemptInsert {
    id: string
    boardId: string
    cardId: string
    agent: string
    status: string
    baseBranch: string
    branchName: string
    worktreePath?: string | null
    sessionId?: string | null
    createdAt?: Date
    updatedAt?: Date
    startedAt?: Date | null
    endedAt?: Date | null
}

export interface AttemptLogRow {
    id: string
    attemptId: string
    ts: Date
    level: string
    message: string
}

export interface AttemptLogInsert {
    id: string
    attemptId: string
    ts?: Date
    level: string
    message: string
}

export interface ConversationItemRow {
    id: string
    attemptId: string
    seq: number
    ts: Date
    itemJson: string
}

export interface ConversationItemInsert {
    id: string
    attemptId: string
    seq: number
    ts?: Date
    itemJson: string
}

export interface AttemptTodoRow {
    attemptId: string
    todosJson: string
    updatedAt: Date
}

export interface AttemptTodoInsert {
    attemptId: string
    todosJson: string
    updatedAt?: Date
}

export interface AgentProfileRow {
    id: string
    projectId: string
    agent: string
    name: string
    configJson: string
    createdAt: Date
    updatedAt: Date
}

export interface AgentProfileInsert {
    id: string
    projectId: string
    agent: string
    name: string
    configJson: string
    createdAt?: Date
    updatedAt?: Date
}

export interface AgentProfileGlobalRow {
    id: string
    agent: string
    name: string
    configJson: string
    createdAt: Date
    updatedAt: Date
}

export interface AgentProfileGlobalInsert {
    id: string
    agent: string
    name: string
    configJson: string
    createdAt?: Date
    updatedAt?: Date
}

export interface GithubConnectionRow {
    id: string
    username: string | null
    primaryEmail: string | null
    accessToken: string | null
    tokenType: string | null
    scope: string | null
    createdAt: Date
    updatedAt: Date
}

export interface GithubConnectionInsert {
    id: string
    username?: string | null
    primaryEmail?: string | null
    accessToken?: string | null
    tokenType?: string | null
    scope?: string | null
    createdAt?: Date
    updatedAt?: Date
}

export interface GithubIssueRow {
    id: string
    boardId: string
    cardId: string
    owner: string
    repo: string
    direction: string
    issueId: string
    issueNumber: number
    titleSnapshot: string
    url: string
    state: string
    createdAt: Date
    updatedAt: Date
}

export interface GithubIssueInsert {
    id: string
    boardId: string
    cardId: string
    owner: string
    repo: string
    direction?: string
    issueId: string
    issueNumber: number
    titleSnapshot: string
    url: string
    state: string
    createdAt?: Date
    updatedAt?: Date
}

export interface AppSettingsRow {
    id: string
    theme: string
    language: string
    telemetryEnabled: boolean
    notifToastSounds: boolean
    notifDesktop: boolean
    autoStartAgentOnInProgress: boolean
    editorType: string
    editorCommand: string | null
    gitUserName: string | null
    gitUserEmail: string | null
    branchTemplate: string
    ghPrTitleTemplate: string | null
    ghPrBodyTemplate: string | null
    ghAutolinkTickets: boolean
    opencodePort: number
    createdAt: Date
    updatedAt: Date
}

export interface AppSettingsInsert {
    id?: string
    theme?: string
    language?: string
    telemetryEnabled?: boolean
    notifToastSounds?: boolean
    notifDesktop?: boolean
    autoStartAgentOnInProgress?: boolean
    editorType?: string
    editorCommand?: string | null
    gitUserName?: string | null
    gitUserEmail?: string | null
    branchTemplate?: string
    ghPrTitleTemplate?: string | null
    ghPrBodyTemplate?: string | null
    ghAutolinkTickets?: boolean
    opencodePort?: number
    createdAt?: Date
    updatedAt?: Date
}

export interface OnboardingStateRow {
    id: string
    status: string
    lastStep: string | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface OnboardingStateInsert {
    id?: string
    status?: string
    lastStep?: string | null
    completedAt?: Date | null
    createdAt?: Date
    updatedAt?: Date
}

export interface GithubAppConfigRow {
    id: string
    clientId: string
    clientSecret: string | null
    createdAt: Date
    updatedAt: Date
}

export interface GithubAppConfigInsert {
    id?: string
    clientId: string
    clientSecret?: string | null
    createdAt?: Date
    updatedAt?: Date
}

export interface CardDependencyRow {
    cardId: string
    dependsOnCardId: string
    createdAt: Date
}

export interface CardDependencyInsert {
    cardId: string
    dependsOnCardId: string
    createdAt?: Date
}

export type CardEnhancementStatus = 'enhancing' | 'ready'

export interface CardEnhancementRow {
    cardId: string
    status: CardEnhancementStatus
    suggestionTitle: string | null
    suggestionDescription: string | null
    updatedAt: Date
}

export interface CardEnhancementInsert {
    cardId: string
    status: CardEnhancementStatus
    suggestionTitle?: string | null
    suggestionDescription?: string | null
    updatedAt?: Date
}

export interface CardImagesRow {
    cardId: string
    imagesJson: string
    createdAt: Date
}

export interface CardImagesInsert {
    cardId: string
    imagesJson: string
    createdAt?: Date
}

/** @deprecated Use BoardRow instead */
export type Board = BoardRow
/** @deprecated Use ColumnRow instead */
export type Column = ColumnRow
/** @deprecated Use CardRow instead */
export type Card = CardRow
/** @deprecated Use AttemptRow instead */
export type Attempt = AttemptRow
/** @deprecated Use AttemptLogRow instead */
export type AttemptLog = AttemptLogRow
/** @deprecated Use AgentProfileRow instead */
export type AgentProfile = AgentProfileRow
/** @deprecated Use AgentProfileGlobalRow instead */
export type AgentProfileGlobal = AgentProfileGlobalRow
/** @deprecated Use GithubConnectionRow instead */
export type GithubConnection = GithubConnectionRow
/** @deprecated Use CardDependencyRow instead */
export type CardDependency = CardDependencyRow
