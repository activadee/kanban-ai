import type {AppServices} from '../env'
import type {AppEventBus} from './bus'
import {registerTaskListeners, bindGitEventBus, registerGitListeners, bindAgentEventBus} from 'core'
import {registerSSEListeners} from '../sse/listeners'
import {bindWorktreeEventBus} from '../fs/worktree-runner'
import {registerFsListeners} from '../fs/listeners'
import {registerSettingsListeners} from '../settings/listeners'
import {registerDashboardListeners} from '../dashboard/listeners'
import {registerTerminalListeners} from '../terminal/listeners'
import {bindTerminalEventBus} from '../terminal/terminal.ws'

export function registerEventListeners(bus: AppEventBus, services: AppServices) {
    void services
    bindWorktreeEventBus(bus)
    bindGitEventBus(bus)
    bindAgentEventBus(bus)
    bindTerminalEventBus(bus)
    registerFsListeners(bus)
    registerGitListeners(bus)
    registerTaskListeners(bus)
    registerSettingsListeners(bus)
    registerSSEListeners(bus)
    registerDashboardListeners(bus)
    registerTerminalListeners(bus)
}
