import {describe, it, expect, beforeEach} from 'vitest'
import {
    setRepoProvider,
    getRepoProvider,
    getProjectsRepo,
    getProjectSettingsRepo,
    getAttemptsRepo,
    getAgentProfilesRepo,
    getAgentProfilesGlobalRepo,
    getGithubRepo,
    getAppSettingsRepo,
    getOnboardingRepo,
    getDependenciesRepo,
    getEnhancementsRepo,
    getDashboardRepo,
    withRepoTx,
} from '../src/repos/provider'
import type {RepoProvider} from '../src/repos/interfaces'

const createMockProvider = (): RepoProvider => ({
    projects: {} as RepoProvider['projects'],
    projectSettings: {} as RepoProvider['projectSettings'],
    attempts: {} as RepoProvider['attempts'],
    agentProfiles: {} as RepoProvider['agentProfiles'],
    agentProfilesGlobal: {} as RepoProvider['agentProfilesGlobal'],
    github: {} as RepoProvider['github'],
    appSettings: {} as RepoProvider['appSettings'],
    onboarding: {} as RepoProvider['onboarding'],
    dependencies: {} as RepoProvider['dependencies'],
    enhancements: {} as RepoProvider['enhancements'],
    dashboard: {} as RepoProvider['dashboard'],
    withTx: async <T>(fn: (p: RepoProvider) => Promise<T>) => fn({} as RepoProvider),
})

describe('repos/provider', () => {
    beforeEach(() => {
        setRepoProvider(null as unknown as RepoProvider)
    })

    describe('setRepoProvider / getRepoProvider', () => {
        it('stores and retrieves the provider', () => {
            const mockProvider = createMockProvider()
            setRepoProvider(mockProvider)
            expect(getRepoProvider()).toBe(mockProvider)
        })

        it('throws when no provider is set', () => {
            expect(() => getRepoProvider()).toThrow(
                'RepoProvider not initialized. Call setRepoProvider() before using repositories.',
            )
        })
    })

    describe('convenience getters', () => {
        it('getProjectsRepo returns projects repo', () => {
            const mockProvider = createMockProvider()
            const projectsRepo = {listBoards: () => Promise.resolve([])}
            mockProvider.projects = projectsRepo as RepoProvider['projects']
            setRepoProvider(mockProvider)
            expect(getProjectsRepo()).toBe(projectsRepo)
        })

        it('getProjectSettingsRepo returns projectSettings repo', () => {
            const mockProvider = createMockProvider()
            const repo = {getProjectSettingsRow: () => Promise.resolve(null)}
            mockProvider.projectSettings = repo as RepoProvider['projectSettings']
            setRepoProvider(mockProvider)
            expect(getProjectSettingsRepo()).toBe(repo)
        })

        it('getAttemptsRepo returns attempts repo', () => {
            const mockProvider = createMockProvider()
            const repo = {getAttemptById: () => Promise.resolve(null)}
            mockProvider.attempts = repo as RepoProvider['attempts']
            setRepoProvider(mockProvider)
            expect(getAttemptsRepo()).toBe(repo)
        })

        it('getAgentProfilesRepo returns agentProfiles repo', () => {
            const mockProvider = createMockProvider()
            const repo = {listAgentProfiles: () => Promise.resolve([])}
            mockProvider.agentProfiles = repo as RepoProvider['agentProfiles']
            setRepoProvider(mockProvider)
            expect(getAgentProfilesRepo()).toBe(repo)
        })

        it('getAgentProfilesGlobalRepo returns agentProfilesGlobal repo', () => {
            const mockProvider = createMockProvider()
            const repo = {listGlobalAgentProfiles: () => Promise.resolve([])}
            mockProvider.agentProfilesGlobal = repo as RepoProvider['agentProfilesGlobal']
            setRepoProvider(mockProvider)
            expect(getAgentProfilesGlobalRepo()).toBe(repo)
        })

        it('getGithubRepo returns github repo', () => {
            const mockProvider = createMockProvider()
            const repo = {getGithubConnection: () => Promise.resolve(null)}
            mockProvider.github = repo as RepoProvider['github']
            setRepoProvider(mockProvider)
            expect(getGithubRepo()).toBe(repo)
        })

        it('getAppSettingsRepo returns appSettings repo', () => {
            const mockProvider = createMockProvider()
            const repo = {getAppSettingsRow: () => Promise.resolve(null)}
            mockProvider.appSettings = repo as RepoProvider['appSettings']
            setRepoProvider(mockProvider)
            expect(getAppSettingsRepo()).toBe(repo)
        })

        it('getOnboardingRepo returns onboarding repo', () => {
            const mockProvider = createMockProvider()
            const repo = {getOnboardingState: () => Promise.resolve(null)}
            mockProvider.onboarding = repo as RepoProvider['onboarding']
            setRepoProvider(mockProvider)
            expect(getOnboardingRepo()).toBe(repo)
        })

        it('getDependenciesRepo returns dependencies repo', () => {
            const mockProvider = createMockProvider()
            const repo = {listDependencies: () => Promise.resolve([])}
            mockProvider.dependencies = repo as RepoProvider['dependencies']
            setRepoProvider(mockProvider)
            expect(getDependenciesRepo()).toBe(repo)
        })

        it('getEnhancementsRepo returns enhancements repo', () => {
            const mockProvider = createMockProvider()
            const repo = {listCardEnhancementsForBoard: () => Promise.resolve([])}
            mockProvider.enhancements = repo as RepoProvider['enhancements']
            setRepoProvider(mockProvider)
            expect(getEnhancementsRepo()).toBe(repo)
        })

        it('getDashboardRepo returns dashboard repo', () => {
            const mockProvider = createMockProvider()
            const repo = {countBoards: () => Promise.resolve(0)}
            mockProvider.dashboard = repo as RepoProvider['dashboard']
            setRepoProvider(mockProvider)
            expect(getDashboardRepo()).toBe(repo)
        })
    })

    describe('withRepoTx', () => {
        it('delegates to provider.withTx', async () => {
            const mockProvider = createMockProvider()
            let txCalled = false
            mockProvider.withTx = async <T>(fn: (p: RepoProvider) => Promise<T>) => {
                txCalled = true
                return fn(mockProvider)
            }
            setRepoProvider(mockProvider)

            const result = await withRepoTx(async () => 'test-result')
            expect(txCalled).toBe(true)
            expect(result).toBe('test-result')
        })
    })
})
