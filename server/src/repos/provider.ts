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
import {createCardImagesRepo} from './card-images.repo'
import type {DbClient, DbExecutor} from '../db/client'

function createRepoProviderInternal(db: DbExecutor): RepoProvider {
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
        cardImages: createCardImagesRepo(db),

        async withTx<T>(fn: (provider: RepoProvider) => Promise<T>): Promise<T> {
            return db.transaction(async (tx) => {
                const txProvider = createRepoProviderInternal(tx as DbExecutor)
                return fn(txProvider)
            })
        },
    }
}

export function createDrizzleRepoProvider(db: DbClient): RepoProvider {
    return createRepoProviderInternal(db)
}
