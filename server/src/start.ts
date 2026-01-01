import type { ServerConfig } from './env'
import { setRuntimeConfig } from './env'
import { markReady } from './runtime'
import { createDbClient } from './db/client'
import { applyLogConfig } from './log'
import type { DbResources } from './db/client'
import { bootstrapRuntime } from './start-core'

type BunServeOptions = Parameters<typeof Bun.serve>[0];

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
    // SSE connections are long-lived; set high idle timeout
    idleTimeout: 255, // max value in seconds
    // Minimal websocket handler (unused, but required by Bun's serve types)
    websocket: {
      message() {},
    },
  })

  const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${server.port}`
  const dbFile = dbResources.sqlite.filename ?? dbResources.path
  markReady()
  return {server, url, dbFile, migrationsDir}
}

export {bootstrapRuntime} from './start-core'
