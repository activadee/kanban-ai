import type { AppEnv, ServerConfig } from './env'
import { setRuntimeConfig } from './env'
import type { UpgradeWebSocket } from 'hono/ws'
import { markReady } from './runtime'
import { createDbClient } from './db/client'
import { applyLogConfig } from './log'
import type { DbResources } from './db/client'
import { bootstrapRuntime } from './start-core'

type BunServeOptions = Parameters<typeof Bun.serve>[0];

export type StartOptions = {
  config: ServerConfig
  fetch: NonNullable<BunServeOptions['fetch']>
  websocket: NonNullable<BunServeOptions['websocket']>
  migrationsDir?: string
  db?: DbResources
}

export type StartResult = {
  server: ReturnType<(typeof Bun)['serve']>
  url: string
  dbFile: string | undefined
  migrationsDir: string
}

export async function createWebSocket(): Promise<{
  upgradeWebSocket: UpgradeWebSocket<AppEnv>
  websocket: NonNullable<BunServeOptions['websocket']>
}> {
  const {createBunWebSocket} = await import('hono/bun')
  const {upgradeWebSocket, websocket} = createBunWebSocket()
  return {
    upgradeWebSocket: upgradeWebSocket as UpgradeWebSocket<AppEnv>,
    websocket: websocket as NonNullable<BunServeOptions['websocket']>,
  }
}

export async function startServer(options: StartOptions): Promise<StartResult> {
  const config = options.config
  setRuntimeConfig(config)
  applyLogConfig(config)
  const dbResources = options.db ?? createDbClient(config)
  const migrationsDir = await bootstrapRuntime(
    config,
    dbResources,
    options.migrationsDir ?? config.migrationsDir,
  )

  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    fetch: options.fetch,
    websocket: options.websocket,
    // SSE connections are long-lived; disable idle timeout
    idleTimeout: 255, // max value in seconds (0 disables but may cause issues)
  })

  const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${server.port}`
  const dbFile = dbResources.sqlite.filename ?? dbResources.path
  markReady()
  return {server, url, dbFile, migrationsDir}
}

export {bootstrapRuntime} from './start-core'
