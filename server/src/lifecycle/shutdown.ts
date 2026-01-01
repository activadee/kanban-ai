import {shutdownOpencodeServers, getOpencodeServerCount} from 'core'
import {log} from '../log'

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000
const FORCED_EXIT_CODE = 1

let shutdownInProgress = false
let signalHandlersRegistered = false

async function performGracefulShutdown(signal: string): Promise<void> {
    if (shutdownInProgress) {
        return
    }
    shutdownInProgress = true

    const serverCount = getOpencodeServerCount()
    if (serverCount === 0) {
        log.info('shutdown', `received ${signal}, no OpenCode servers running`)
        process.exit(0)
    }

    log.info('shutdown', `received ${signal}, shutting down ${serverCount} OpenCode server(s)...`)

    const forceExitTimer = setTimeout(() => {
        log.warn('shutdown', 'graceful shutdown timed out, forcing exit')
        process.exit(FORCED_EXIT_CODE)
    }, GRACEFUL_SHUTDOWN_TIMEOUT_MS)

    try {
        await shutdownOpencodeServers()
        clearTimeout(forceExitTimer)
        log.info('shutdown', 'graceful shutdown complete')
        process.exit(0)
    } catch (err) {
        clearTimeout(forceExitTimer)
        log.error('shutdown', 'error during shutdown', {err})
        process.exit(FORCED_EXIT_CODE)
    }
}

export function registerShutdownHandlers(): void {
    if (signalHandlersRegistered) {
        return
    }
    signalHandlersRegistered = true

    process.on('SIGTERM', () => {
        void performGracefulShutdown('SIGTERM')
    })

    process.on('SIGINT', () => {
        void performGracefulShutdown('SIGINT')
    })
}

export function isShutdownInProgress(): boolean {
    return shutdownInProgress
}

export {GRACEFUL_SHUTDOWN_TIMEOUT_MS}
