import {
    bindAgentEventBus,
    registerAgent,
    getAgent,
    listAgents,
    CodexAgent,
    OpencodeAgent,
} from 'core'

// Register only stable, supported agents here.
// Droid remains experimental/WIP and is intentionally
// hidden from the public API/UI.
registerAgent(CodexAgent)
registerAgent(OpencodeAgent)

export {bindAgentEventBus, registerAgent, getAgent, listAgents}
