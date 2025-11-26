import {
    bindAgentEventBus,
    registerAgent,
    getAgent,
    listAgents,
    CodexAgent,
} from 'core'

// Register only stable, supported agents here.
// Experimental agents (e.g., Droid, OpenCode) remain unregistered/WIP
// and are intentionally hidden from the public API/UI.
registerAgent(CodexAgent)

export {bindAgentEventBus, registerAgent, getAgent, listAgents}
