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
import type {DbClient} from '../db/client'

export function createDrizzleRepoProvider(db: DbClient): RepoProvider {
    const baseDb = db as unknown as BunSQLiteDatabase
    return {
        projects: createProjectsRepo(baseDb),
        projectSettings: createProjectSettingsRepo(baseDb),
        attempts: createAttemptsRepo(baseDb),
        agentProfiles: createAgentProfilesRepo(baseDb),
        agentProfilesGlobal: createAgentProfilesGlobalRepo(baseDb),
        github: createGithubRepo(baseDb),
        appSettings: createAppSettingsRepo(baseDb),
        onboarding: createOnboardingRepo(baseDb),
        dependencies: createDependenciesRepo(baseDb),
        enhancements: createEnhancementsRepo(baseDb),
        dashboard: createDashboardRepo(baseDb),

        async withTx<T>(fn: (provider: RepoProvider) => Promise<T>): Promise<T> {
            return db.transaction(async (tx) => {
                const txProvider = createDrizzleRepoProvider(tx as unknown as DbClient)
                return fn(txProvider)
            })
        },
    }
}
