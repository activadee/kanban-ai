import type {Agent} from './types'
import type {AppEventBus} from '../events/bus'

const registry = new Map<string, Agent<any>>()
let agentEvents: AppEventBus | null = null

export function bindAgentEventBus(bus: AppEventBus) {
    agentEvents = bus
    queueMicrotask(() => {
        for (const agent of registry.values()) {
            agentEvents?.publish('agent.registered', {agent: agent.key, label: agent.label})
        }
    })
}

export function registerAgent<P>(agent: Agent<P>) {
    registry.set(agent.key, agent as Agent<P>)
    if (agentEvents) agentEvents.publish('agent.registered', {agent: agent.key, label: agent.label})
}

export function getAgent(key: string): Agent<any> | undefined {
    return registry.get(key)
}

export function listAgents(): Agent<any>[] {
    return Array.from(registry.values())
}

export function __resetAgentRegistryForTests() {
    registry.clear()
    agentEvents = null
}
