/**
 * OpenCode server management utilities.
 */

// Default port for OpenCode server
export const DEFAULT_OPENCODE_PORT = 4097

// Reserved ports that should not be used
const RESERVED_PORTS = new Set([80, 443, 22, 25, 53, 110, 143, 993, 995, 3306, 5432, 6379, 8080, 8443])

/**
 * Validates that a port number is within valid range and not reserved.
 * @param port - The port number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPort(port: unknown): port is number {
    return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535 && !RESERVED_PORTS.has(port)
}

export function getEffectivePort(settingsPort: unknown): number {
    return isValidPort(settingsPort) ? settingsPort : DEFAULT_OPENCODE_PORT
}

export type ServerHandle = {
    close: () => void
}

export type ServerInstance = ServerHandle & {
    url: string
    port: number
}

/**
 * Manages OpenCode server instances by port.
 */
export class OpencodeServerManager {
    private static readonly serversByPort = new Map<number, ServerInstance>()
    private static shutdownInProgress = false

    static async shutdownAllServers(): Promise<void> {
        if (OpencodeServerManager.shutdownInProgress) {
            return
        }
        OpencodeServerManager.shutdownInProgress = true

        const servers = Array.from(OpencodeServerManager.serversByPort.entries())
        if (servers.length === 0) {
            OpencodeServerManager.shutdownInProgress = false
            return
        }

        const errors: Array<{port: number; error: unknown}> = []
        const closePromises = servers.map(async ([port, server]) => {
            try {
                server.close()
                OpencodeServerManager.serversByPort.delete(port)
            } catch (err) {
                errors.push({port, error: err})
                OpencodeServerManager.serversByPort.delete(port)
            }
        })

        await Promise.all(closePromises)
        OpencodeServerManager.shutdownInProgress = false

        if (errors.length > 0) {
            const errorMessages = errors.map((e) => `port ${e.port}: ${String(e.error)}`).join(', ')
            throw new Error(`Failed to close OpenCode servers: ${errorMessages}`)
        }
    }

    static getActiveServerCount(): number {
        return OpencodeServerManager.serversByPort.size
    }

    static isShuttingDown(): boolean {
        return OpencodeServerManager.shutdownInProgress
    }

    static getServer(port: number): ServerInstance | undefined {
        return OpencodeServerManager.serversByPort.get(port)
    }

    static setServer(port: number, server: ServerInstance): void {
        OpencodeServerManager.serversByPort.set(port, server)
    }

    /**
     * Clears all servers for testing purposes only.
     * @internal
     */
    static clearForTesting(): void {
        OpencodeServerManager.serversByPort.clear()
        OpencodeServerManager.shutdownInProgress = false
    }
}
