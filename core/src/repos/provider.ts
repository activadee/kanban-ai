import type {
    RepoProvider,
    ProjectsRepo,
    ProjectSettingsRepo,
    AttemptsRepo,
    AgentProfilesRepo,
    AgentProfilesGlobalRepo,
    GithubRepo,
    AppSettingsRepo,
    OnboardingRepo,
    DependenciesRepo,
    EnhancementsRepo,
    DashboardRepo,
} from './interfaces'

let _provider: RepoProvider | null = null

export function setRepoProvider(provider: RepoProvider): void {
    _provider = provider
}

export function getRepoProvider(): RepoProvider {
    if (!_provider) {
        throw new Error(
            'RepoProvider not initialized. Call setRepoProvider() before using repositories.',
        )
    }
    return _provider
}

export function getProjectsRepo(): ProjectsRepo {
    return getRepoProvider().projects
}

export function getProjectSettingsRepo(): ProjectSettingsRepo {
    return getRepoProvider().projectSettings
}

export function getAttemptsRepo(): AttemptsRepo {
    return getRepoProvider().attempts
}

export function getAgentProfilesRepo(): AgentProfilesRepo {
    return getRepoProvider().agentProfiles
}

export function getAgentProfilesGlobalRepo(): AgentProfilesGlobalRepo {
    return getRepoProvider().agentProfilesGlobal
}

export function getGithubRepo(): GithubRepo {
    return getRepoProvider().github
}

export function getAppSettingsRepo(): AppSettingsRepo {
    return getRepoProvider().appSettings
}

export function getOnboardingRepo(): OnboardingRepo {
    return getRepoProvider().onboarding
}

export function getDependenciesRepo(): DependenciesRepo {
    return getRepoProvider().dependencies
}

export function getEnhancementsRepo(): EnhancementsRepo {
    return getRepoProvider().enhancements
}

export function getDashboardRepo(): DashboardRepo {
    return getRepoProvider().dashboard
}

export function withRepoTx<T>(fn: (provider: RepoProvider) => Promise<T>): Promise<T> {
    return getRepoProvider().withTx(fn)
}
