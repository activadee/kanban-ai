import {
    bindAgentEventBus,
    registerAgent,
    getAgent,
    listAgents,
    CodexAgent,
    OpencodeAgent,
    DroidAgent,
} from 'core'

registerAgent(CodexAgent)
registerAgent(OpencodeAgent)
registerAgent(DroidAgent)

export {bindAgentEventBus, registerAgent, getAgent, listAgents}
