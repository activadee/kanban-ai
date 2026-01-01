import {OpencodeImpl} from './core/agent'

export {OpencodeAgent, OpencodeImpl} from './core/agent'
export {
    OpencodeProfileSchema,
    defaultProfile as defaultOpencodeProfile,
} from './profiles/schema'

export function shutdownOpencodeServers(): Promise<void> {
    return OpencodeImpl.shutdownAllServers()
}

export function getOpencodeServerCount(): number {
    return OpencodeImpl.getActiveServerCount()
}

export function isOpencodeShuttingDown(): boolean {
    return OpencodeImpl.isShuttingDown()
}
