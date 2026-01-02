import type {AgentEventMap} from './types/agent-events'
import type {AttemptEventMap} from './types/attempt-events'
import type {DashboardEventMap} from './types/dashboard-events'
import type {EditorEventMap} from './types/editor-events'
import type {GitEventMap} from './types/git-events'
import type {ProjectEventMap} from './types/project-events'
import type {SettingsEventMap} from './types/settings-events'
import type {TaskEventMap} from './types/task-events'
import type {TerminalEventMap} from './types/terminal-events'

export type AppEventMap = ProjectEventMap &
    TaskEventMap &
    AttemptEventMap &
    GitEventMap &
    SettingsEventMap &
    EditorEventMap &
    AgentEventMap &
    DashboardEventMap &
    TerminalEventMap

export type AppEventName = keyof AppEventMap
export type AppEventPayload<Name extends AppEventName> = AppEventMap[Name]

export type AppEvent<Name extends AppEventName = AppEventName> = {
    name: Name
    payload: AppEventPayload<Name>
}

export type AppEventHandler<Name extends AppEventName> = (payload: AppEventPayload<Name>) => void | Promise<void>

export * from './types/agent-events'
export * from './types/attempt-events'
export * from './types/dashboard-events'
export * from './types/editor-events'
export * from './types/git-events'
export * from './types/project-events'
export * from './types/settings-events'
export * from './types/task-events'
