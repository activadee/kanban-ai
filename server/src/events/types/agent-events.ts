export interface AgentProfileChangedEvent {
    profileId: string
    agent: string
    kind: 'created' | 'updated' | 'deleted'
    label?: string
}

export interface AgentRegisteredEvent {
    agent: string
    label?: string
}

export type AgentEventMap = {
    'agent.profile.changed': AgentProfileChangedEvent
    'agent.registered': AgentRegisteredEvent
}
