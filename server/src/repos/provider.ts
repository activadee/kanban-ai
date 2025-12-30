import type {BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite'
import type {RepoProvider} from 'core/repos/interfaces'
import {createProjectsRepo} from './projects.repo'
import {createProjectSettingsRepo} from './project-settings.repo'
import {createAttemptsRepo} from './attempts.repo'
import {createAgentProfilesRepo, createAgentProfilesGlobalRepo} from './agents.repo'
import {createGithubRepo} from './github.repo'
import {createAppSettingsRepo} from './settings.repo'
import {createOnboardingRepo} from './onboarding.repo'
import {createDependenciesRepo} from './dependencies.repo'
import {createEnhancementsRepo} from './enhancements.repo'
import {createDashboardRepo} from './dashboard.repo'

export function createDrizzleRepoProvider(db: BunSQLiteDatabase): RepoProvider {
    return {
        projects: createProjectsRepo(db),
        projectSettings: createProjectSettingsRepo(db),
        attempts: createAttemptsRepo(db),
        agentProfiles: createAgentProfilesRepo(db),
        agentProfilesGlobal: createAgentProfilesGlobalRepo(db),
        github: createGithubRepo(db),
        appSettings: createAppSettingsRepo(db),
        onboarding: createOnboardingRepo(db),
        dependencies: createDependenciesRepo(db),
        enhancements: createEnhancementsRepo(db),
        dashboard: createDashboardRepo(db),

        async withTx<T>(fn: (provider: RepoProvider) => Promise<T>): Promise<T> {
            return db.transaction(async (tx) => {
                const txProvider = createDrizzleRepoProvider(tx as unknown as BunSQLiteDatabase)
                return fn(txProvider)
            })
        },
    }
}
