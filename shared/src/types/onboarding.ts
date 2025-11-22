import type {AppSettings} from './app'
import type {GitHubCheckResponse} from './github'

export type OnboardingStatus = {
    status: 'pending' | 'completed'
    lastStep: string | null
    startedAt: string | null
    completedAt: string | null
}

export type OnboardingSnapshot = {
    status: OnboardingStatus
    settings: AppSettings
    githubAuth: GitHubCheckResponse
}

export type GithubAppConfig = {
    clientId: string | null
    hasClientSecret: boolean
    updatedAt: string | null
    source: 'db' | 'env' | 'unset'
}

export type UpsertGithubAppConfigRequest = {
    clientId: string
    clientSecret: string | null
}
