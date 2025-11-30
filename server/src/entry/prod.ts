import { createApp } from '../app'
import { createWebSocket, startServer, type StartOptions } from '../start'
import { createStaticHandler } from './utils/spa-handler'
import { log, applyLogConfig } from '../log'
import { loadConfig, setRuntimeConfig } from '../env'

type ProdFetch = StartOptions['fetch']

const createComposedFetch = (apiApp: ReturnType<typeof createApp>, staticDir?: string): ProdFetch => {
  const serveStatic = createStaticHandler(staticDir)

  return async function fetch(request, server) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api')) {
      // Forward Bun's server object through to Hono so hono/bun websocket
      // integration can retrieve it via c.env. This is an adapter boundary,
      // so we intentionally cast here.
      return apiApp.fetch(request, server as unknown as any)
    }

    const staticResponse = await serveStatic(request)
    if (staticResponse) return staticResponse

    return apiApp.fetch(request, server as unknown as any)
  }
}

const run = async () => {
  const args = Bun.argv.slice(2)
  const baseConfig = loadConfig()

  const getArg = (name: string, alias?: string): string | undefined => {
    const i = args.indexOf(name)
    const j = alias ? args.indexOf(alias) : -1
    const idx = i >= 0 ? i : j
    if (idx >= 0 && idx + 1 < args.length) return args[idx + 1]
    return undefined
  }

  const hasFlag = (name: string) => args.includes(name)

  if (hasFlag('--help') || hasFlag('-h')) {
    const usage = `
  kanbanai — production server (API + static UI)

  Usage:
    bun run server/src/entry/prod.ts [--host <host>] [--port <port>] [--migrations-dir <path>]
    bun run prod                    # via root package.json script
  `
    log.info('prod', 'usage', { usage: usage.trim() })
    return
  }

  const port = Number(getArg('--port', '-p') ?? baseConfig.port)
  const host = getArg('--host') ?? baseConfig.host
  const migrationsDir = getArg('--migrations-dir') ?? baseConfig.migrationsDir

  const config = {
    ...baseConfig,
    host,
    port: Number.isFinite(port) ? port : baseConfig.port,
    migrationsDir: migrationsDir ?? baseConfig.migrationsDir,
  }

  setRuntimeConfig(config)
  applyLogConfig(config)

  const { upgradeWebSocket, websocket } = await createWebSocket()
  const apiApp = createApp({ upgradeWebSocket, config })
  const fetch = createComposedFetch(apiApp, config.staticDir)

  const { url, dbFile, migrationsDir: resolvedMigrationsDir } = await startServer({
    config,
    fetch,
    websocket,
    migrationsDir,
  })

  log.info('prod', 'listening', { url, dbFile, migrationsDir: resolvedMigrationsDir })
}

if (import.meta.main) {
  run().catch((error) => {
    log.error('prod', 'failed to start', { err: error })
    process.exit(1)
  })
}
