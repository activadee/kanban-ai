import type {ServerConfig} from './env'
import {setRuntimeConfig} from './env'
import {markReady} from './runtime'
import {createDbClient} from './db/client'
import {applyLogConfig} from './log'
import type {DbResources} from './db/client'
import {bootstrapRuntime} from './start-core'
import {
    handleTerminalWebSocket,
    handleTerminalMessage,
    handleTerminalClose,
} from './terminal/terminal.ws'
import type {Server, ServerWebSocket} from 'bun'

type BunServeOptions = Parameters<typeof Bun.serve>[0]

export type StartOptions = {
    config: ServerConfig
    fetch: NonNullable<BunServeOptions['fetch']>
    migrationsDir?: string
    db?: DbResources
}

export type StartResult = {
    server: ReturnType<(typeof Bun)['serve']>
    url: string
    dbFile: string | undefined
    migrationsDir: string
}

interface TerminalWSData {
    cardId: string
    projectId: string
}

export async function startServer(options: StartOptions): Promise<StartResult> {
    const config = options.config
    setRuntimeConfig(config)
    applyLogConfig(config)
    const dbResources = options.db ?? createDbClient(config)
    const migrationsDir = await bootstrapRuntime(config, dbResources, options.migrationsDir ?? config.migrationsDir)

    const appFetch = options.fetch as (req: Request, server: Server<TerminalWSData>) => Response | Promise<Response>

    const server = Bun.serve<TerminalWSData>({
        hostname: config.host,
        port: config.port,
        fetch(req: Request, srv: Server<TerminalWSData>) {
            const url = new URL(req.url)

            const terminalMatch = url.pathname.match(/^\/api(?:\/v1)?\/terminals\/([^/]+)\/ws$/)
            if (terminalMatch?.[1] && req.headers.get('upgrade') === 'websocket') {
                const cardId = terminalMatch[1]
                const projectId = url.searchParams.get('projectId') ?? ''

                const success = srv.upgrade(req, {
                    data: {cardId, projectId},
                })

                if (success) {
                    return new Response(null, {status: 101})
                }
                return new Response('WebSocket upgrade failed', {status: 400})
            }

            return appFetch(req, srv)
        },
        idleTimeout: 255,
        websocket: {
            async open(ws: ServerWebSocket<TerminalWSData>) {
                const {cardId, projectId} = ws.data
                if (cardId) {
                    await handleTerminalWebSocket(ws, cardId, projectId)
                }
            },
            message(ws: ServerWebSocket<TerminalWSData>, message: string | Buffer) {
                handleTerminalMessage(ws, message)
            },
            close(ws: ServerWebSocket<TerminalWSData>) {
                handleTerminalClose(ws)
            },
        },
    })

    const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${server.port}`
    const dbFile = dbResources.sqlite.filename ?? dbResources.path
    markReady()
    return {server, url, dbFile, migrationsDir}
}

export {bootstrapRuntime} from './start-core'
