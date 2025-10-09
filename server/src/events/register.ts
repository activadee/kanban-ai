import type {AppServices} from '../env'
import type {AppEventBus} from './bus'
import {registerTaskListeners, bindGitEventBus, registerGitListeners, bindAgentEventBus} from 'core'
import {registerWebSocketListeners} from '../ws/listeners'
import {bindWorktreeEventBus} from '../fs/worktree'
import {registerFsListeners} from '../fs/listeners'
import {registerSettingsListeners} from '../settings/listeners'
import {registerDashboardListeners} from '../dashboard/listeners'

/**
 * Attach domain event listeners to the shared bus. Modules should export registration
 * helpers (e.g. registerAttemptsListeners) that subscribe to the events they care about.
 */
export function registerEventListeners(bus: AppEventBus, services: AppServices) {
    void services
    bindWorktreeEventBus(bus)
    bindGitEventBus(bus)
    bindAgentEventBus(bus)
    registerFsListeners(bus)
    registerGitListeners(bus)
    registerTaskListeners(bus)
    registerSettingsListeners(bus)
    registerWebSocketListeners(bus)
    registerDashboardListeners(bus)
}
