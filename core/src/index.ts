// Public API surface for core (Phase A)
// Initial extraction: provide event bus/types and DB helpers.
// Subsequent PRs will export domain services (projects/tasks/attempts/github/git/fs/settings/agents).

export * from './events/bus'
export * from './events/types'

export * from './db/with-tx'
export {setDbProvider} from './db/provider'
export * from './db/schema'
export * as dbSchema from './db/schema'
export * from './settings/service'
export {discoverGitRepositories} from './fs/repos'
export {ensureGitRepository, getGitOriginUrl, parseGithubOwnerRepo} from './fs/git'

// Domain services (Phase B)
export {projectsService, type ProjectsService} from './projects/service'
export * as projects from './projects/service'
export * as projectsRepo from './projects/repo'
export * as projectDeps from './projects/dependencies'
export * as projectTickets from './projects/tickets/service'
export * as projectSettingsSync from './projects/settings/github-sync'
export * as projectSettingsPrAutoClose from './projects/settings/pr-auto-close'
export * as ticketKeys from './projects/tickets/ticket-keys'

export * as tasks from './tasks/service'
export {registerTaskListeners} from './tasks/listeners'

export * from './attempts/autocommit'
export * as git from './git/service'
export {bindGitEventBus} from './git/service'
export type {FileSource} from './git/service'
export {registerGitListeners} from './git/listeners'
export * as githubRepo from './github/repo'
export * as attempts from './attempts/service'
export * as attemptsRepo from './attempts/repo'
export * as worktree from './ports/worktree'
export {setWorktreeProvider} from './ports/worktree'
export * as agentRegistry from './agents/registry'
export {bindAgentEventBus, registerAgent, getAgent, listAgents} from './agents/registry'
export * as agentTypes from './agents/types'
export {runInlineTask} from './agents/inline'
export {agentEnhanceTicket} from './agents/enhance'
export {agentSummarizePullRequest} from './agents/pr-summary'
export type {
    Agent,
    AgentInfo,
    AgentContext,
    AgentCapabilities,
    TicketEnhanceInput,
    TicketEnhanceResult,
    InlineTaskKind,
    InlineTaskContext,
    InlineTaskInputByKind,
    InlineTaskResultByKind,
    InlineTaskErrorCode,
} from './agents/types'
export type {InlineTaskError} from './agents/types'
export {isInlineTaskError} from './agents/types'
export * as agentProfilesRepo from './agents/repo'
export * as agentProfiles from './agents/profiles'
export * as agentProfilesGlobalRepo from './agents/global-repo'
export * as agentProfilesGlobal from './agents/profiles-global'
export {CommandAgent, type CommandSpec} from './agents/command'
export {SdkAgent} from './agents/sdk'
export {CodexAgent} from './agents/codex'
export {OpencodeAgent} from './agents/opencode'
export {DroidAgent} from './agents/droid'
export {getDashboardOverview} from './dashboard/service'
export * as onboardingRepo from './onboarding/repo'
export {onboardingService} from './onboarding/service'
