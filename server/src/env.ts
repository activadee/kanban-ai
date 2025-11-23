import type {ProjectsService} from 'core'
import type {settingsService} from 'core'
import type {AppEventBus} from './events/bus'

export type EnvBindings = {
    DATABASE_URL?: string
    GITHUB_CLIENT_ID?: string
    GITHUB_CLIENT_SECRET?: string
}

export type AppServices = {
    projects: ProjectsService
    settings: typeof settingsService
}

export type AppEnv = {
    Bindings: EnvBindings
    Variables: {
        services: AppServices
        events: AppEventBus
        projectId?: string
        boardId?: string
    }
}
