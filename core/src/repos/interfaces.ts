import type {
    BoardRow,
    BoardInsert,
    ColumnRow,
    ColumnInsert,
    CardRow,
    CardInsert,
    ProjectSettingsRow,
    ProjectSettingsInsert,
    AttemptRow,
    AttemptInsert,
    AttemptLogRow,
    AttemptLogInsert,
    ConversationItemRow,
    ConversationItemInsert,
    AttemptTodoRow,
    AgentProfileRow,
    AgentProfileInsert,
    AgentProfileGlobalRow,
    AgentProfileGlobalInsert,
    GithubConnectionRow,
    GithubIssueRow,
    GithubIssueInsert,
    GithubAppConfigRow,
    AppSettingsRow,
    OnboardingStateRow,
    CardDependencyRow,
    CardEnhancementRow,
    CardEnhancementStatus,
    CardImagesRow,
} from '../db/types'
import type {TicketType} from 'shared'

export type BoardUpdate = Partial<BoardInsert>
export type ColumnUpdate = Partial<ColumnInsert>
export type CardUpdate = Partial<CardInsert> & {ticketType?: TicketType | null}
export type ProjectSettingsUpdate = Partial<ProjectSettingsInsert>
export type AttemptUpdate = Partial<AttemptInsert>
export type AgentProfileUpdate = Partial<AgentProfileInsert>
export type AgentProfileGlobalUpdate = Partial<AgentProfileGlobalInsert>
export type GithubIssueUpdate = Partial<GithubIssueInsert>

export type CardWithColumnBoard = {
    id: string
    ticketKey: string | null
    boardId: string | null
    columnId: string
    columnBoardId: string | null
    createdAt: Date | number | string
}

export type GithubConnectionUpsert = {
    username: string
    primaryEmail: string | null
    accessToken: string
    tokenType: string
    scope: string | null
}

export type GithubAppConfigUpsert = {
    clientId: string
    clientSecret?: string | null
}

export type GithubIssueStats = {
    imported: number
    exported: number
    total: number
}

export type CardEnhancementRecord = {
    cardId: string
    status: CardEnhancementStatus
    suggestionTitle?: string | null
    suggestionDescription?: string | null
    updatedAt: Date | number | string
}

export interface ProjectsRepo {
    listBoards(): Promise<BoardRow[]>
    getBoardById(id: string): Promise<BoardRow | null>
    listBoardIds(): Promise<string[]>
    getRepositoryPath(boardId: string): Promise<string | null>
    insertBoard(values: BoardInsert): Promise<void>
    updateBoard(id: string, patch: BoardUpdate): Promise<void>
    deleteBoard(id: string): Promise<void>

    listColumnsForBoard(boardId: string): Promise<ColumnRow[]>
    getColumnById(columnId: string): Promise<ColumnRow | null>
    insertColumn(values: ColumnInsert): Promise<void>
    updateColumn(columnId: string, patch: ColumnUpdate): Promise<void>

    listCardsForColumns(columnIds: string[]): Promise<CardRow[]>
    listCardsForBoard(boardId: string): Promise<CardRow[]>
    getCardById(cardId: string): Promise<CardRow | null>
    insertCard(values: CardInsert): Promise<void>
    updateCard(cardId: string, patch: CardUpdate): Promise<void>
    deleteCard(cardId: string): Promise<void>
    getMaxCardOrder(columnId: string): Promise<number>
    listCardsWithColumn(boardId: string): Promise<CardWithColumnBoard[]>
}

export type GithubIssueSyncStatus = 'idle' | 'running' | 'succeeded' | 'failed'
export type GithubPrAutoCloseStatus = 'idle' | 'running' | 'succeeded' | 'failed'

export interface ProjectSettingsRepo {
    getProjectSettingsRow(projectId: string): Promise<ProjectSettingsRow | null>
    insertProjectSettings(values: ProjectSettingsInsert): Promise<void>
    updateProjectSettingsRow(projectId: string, patch: ProjectSettingsUpdate): Promise<void>
    tryStartGithubIssueSync(projectId: string, now: Date, staleCutoff: Date): Promise<boolean>
    completeGithubIssueSync(projectId: string, status: Exclude<GithubIssueSyncStatus, 'running'>, now: Date): Promise<void>
    tryStartGithubPrAutoClose(projectId: string, now: Date, staleCutoff: Date): Promise<boolean>
    completeGithubPrAutoClose(projectId: string, status: Exclude<GithubPrAutoCloseStatus, 'running'>, now: Date): Promise<void>
}

export interface AttemptsRepo {
    getAttemptById(id: string): Promise<AttemptRow | null>
    getAttemptForCard(boardId: string, cardId: string): Promise<AttemptRow | null>
    insertAttempt(values: AttemptInsert): Promise<void>
    updateAttempt(id: string, patch: AttemptUpdate): Promise<void>
    listAttemptsForBoard(boardId: string): Promise<AttemptRow[]>
    getAttemptBoardId(attemptId: string): Promise<string | null>

    listAttemptLogs(attemptId: string): Promise<AttemptLogRow[]>
    insertAttemptLog(values: AttemptLogInsert): Promise<void>

    listConversationItems(attemptId: string): Promise<ConversationItemRow[]>
    listConversationItemsDescending(attemptId: string, limit: number): Promise<Array<{itemJson: string}>>
    insertConversationItem(values: ConversationItemInsert): Promise<void>
    getNextConversationSeq(attemptId: string): Promise<number>

    upsertAttemptTodos(attemptId: string, todosJson: string): Promise<void>
    getAttemptTodos(attemptId: string): Promise<AttemptTodoRow | null>
}

export interface AgentProfilesRepo {
    listAgentProfiles(projectId: string): Promise<AgentProfileRow[]>
    getAgentProfile(projectId: string, id: string): Promise<AgentProfileRow | null>
    insertAgentProfile(values: AgentProfileInsert): Promise<void>
    updateAgentProfileRow(projectId: string, id: string, patch: AgentProfileUpdate): Promise<void>
    deleteAgentProfile(projectId: string, id: string): Promise<void>
}

export interface AgentProfilesGlobalRepo {
    listGlobalAgentProfiles(): Promise<AgentProfileGlobalRow[]>
    getGlobalAgentProfile(id: string): Promise<AgentProfileGlobalRow | null>
    insertGlobalAgentProfile(values: AgentProfileGlobalInsert): Promise<void>
    updateGlobalAgentProfileRow(id: string, patch: AgentProfileGlobalUpdate): Promise<void>
    deleteGlobalAgentProfile(id: string): Promise<void>
}

export interface GithubRepo {
    getGithubConnection(): Promise<GithubConnectionRow | null>
    upsertGithubConnection(data: GithubConnectionUpsert): Promise<GithubConnectionRow>
    deleteGithubConnection(): Promise<void>

    getGithubAppConfig(): Promise<GithubAppConfigRow | null>
    upsertGithubAppConfig(values: GithubAppConfigUpsert): Promise<GithubAppConfigRow>

    findGithubIssueMapping(
        boardId: string,
        owner: string,
        repo: string,
        issueNumber: number,
    ): Promise<GithubIssueRow | null>
    insertGithubIssueMapping(values: GithubIssueInsert): Promise<void>
    updateGithubIssueMapping(id: string, patch: GithubIssueUpdate): Promise<void>
    findGithubIssueMappingByCardId(cardId: string): Promise<GithubIssueRow | null>
    listGithubIssueMappingsByCardId(cardId: string): Promise<GithubIssueRow[]>
    getGithubIssueStats(boardId: string): Promise<GithubIssueStats>
    listCardsWithGithubIssuesNotInDone(
        boardId: string,
        doneColumnIds: string[],
    ): Promise<Array<CardRow & {issueNumber: number; owner: string; repo: string}>>
}

export interface AppSettingsRepo {
    getAppSettingsRow(): Promise<AppSettingsRow | null>
    insertDefaultAppSettings(): Promise<void>
    updateAppSettingsRow(values: Partial<AppSettingsRow>): Promise<void>
}

export interface OnboardingRepo {
    getOnboardingState(): Promise<OnboardingStateRow | null>
    upsertOnboardingState(values: Partial<OnboardingStateRow>): Promise<OnboardingStateRow>
}

export interface DependenciesRepo {
    listDependencies(cardId: string): Promise<string[]>
    listDependenciesForCards(cardIds: string[]): Promise<Map<string, string[]>>
    deleteDependencies(cardId: string): Promise<void>
    insertDependencies(cardId: string, dependsOnIds: string[]): Promise<void>
}

export interface EnhancementsRepo {
    listCardEnhancementsForBoard(boardId: string): Promise<CardEnhancementRecord[]>
    upsertCardEnhancement(record: CardEnhancementRecord): Promise<void>
    deleteCardEnhancement(cardId: string): Promise<void>
}

export interface CardImagesRepo {
    getCardImages(cardId: string): Promise<CardImagesRow | null>
    setCardImages(cardId: string, imagesJson: string): Promise<void>
    deleteCardImages(cardId: string): Promise<void>
}

export type DashboardAttemptRowForInbox = {
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

export type DashboardBoardRow = {
    id: string
    name: string
    repositorySlug: string | null
    repositoryPath: string
    createdAt: Date | number
}

export type DashboardColumnCountRow = {
    boardId: string
    columnTitle: string
    count: number | null
}

export type DashboardActiveCountRow = {
    boardId: string
    count: number
}

export type DashboardAttemptsPerBoardRow = {
    boardId: string | null
    total: number | null
    failed: number | null
}

export type DashboardActiveAttemptRow = {
    attemptId: string
    projectId: string | null
    projectName: string | null
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    agent: string
    status: string
    startedAt: Date | number | null
    updatedAt: Date | number | null
}

export type DashboardRecentActivityRow = {
    attemptId: string
    projectId: string | null
    projectName: string | null
    cardId: string
    cardTitle: string | null
    ticketKey: string | null
    agent: string
    status: string
    finishedAt: Date | number | null
    startedAt: Date | number | null
    createdAt: Date | number | null
}

export type DashboardAgentAggregateRow = {
    agent: string | null
    attemptsInRange: number | null
    succeededInRange: number | null
    failedInRange: number | null
    lastActivityAt: Date | null
}

export type DashboardAgentLifetimeRow = {
    agent: string | null
    lastActiveAt: Date | null
}

export interface DashboardRepo {
    countBoards(): Promise<number>

    countAttemptsInRange(
        rangeFrom: Date | null,
        rangeTo: Date | null,
    ): Promise<{total: number; succeeded: number}>

    countProjectsWithActivityInRange(rangeFrom: Date | null, rangeTo: Date | null): Promise<number>

    countActiveAttempts(): Promise<number>

    countCompletedAttemptsInRange(rangeFrom: Date | null, rangeTo: Date | null): Promise<number>

    getColumnCardCounts(): Promise<DashboardColumnCountRow[]>

    getActiveAttemptCountsByBoard(): Promise<DashboardActiveCountRow[]>

    getAttemptsPerBoardInRange(
        rangeFrom: Date | null,
        rangeTo: Date | null,
    ): Promise<DashboardAttemptsPerBoardRow[]>

    getActiveAttemptRows(limit: number): Promise<DashboardActiveAttemptRow[]>

    getRecentActivityRows(
        rangeFrom: Date | null,
        rangeTo: Date | null,
        limit: number,
    ): Promise<DashboardRecentActivityRow[]>

    getBoardRows(limit: number): Promise<DashboardBoardRow[]>

    getAgentAggregates(
        agentKeys: string[],
        rangeFrom: Date | null,
        rangeTo: Date | null,
    ): Promise<DashboardAgentAggregateRow[]>

    getAgentLifetimeStats(agentKeys: string[]): Promise<DashboardAgentLifetimeRow[]>

    getInboxAttemptRows(
        rangeFrom: Date | null,
        rangeTo: Date | null,
        limit: number,
    ): Promise<DashboardAttemptRowForInbox[]>
}

export interface RepoProvider {
    projects: ProjectsRepo
    projectSettings: ProjectSettingsRepo
    attempts: AttemptsRepo
    agentProfiles: AgentProfilesRepo
    agentProfilesGlobal: AgentProfilesGlobalRepo
    github: GithubRepo
    appSettings: AppSettingsRepo
    onboarding: OnboardingRepo
    dependencies: DependenciesRepo
    enhancements: EnhancementsRepo
    dashboard: DashboardRepo
    cardImages: CardImagesRepo

    withTx<T>(fn: (provider: RepoProvider) => Promise<T>): Promise<T>
}
