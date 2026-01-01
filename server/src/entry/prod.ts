import { createApp } from '../app'
import { startServer, type StartOptions } from '../start'
import { createStaticHandler } from './utils/spa-handler'
import { log, applyLogConfig } from '../log'
import { loadConfig, setRuntimeConfig, type AppServices } from '../env'
import { createEventBus } from '../events/bus'
import { startGithubIssueSyncScheduler } from '../github/sync'
import { startGithubPrAutoCloseScheduler } from '../github/pr-auto-close.sync'
import { projectsService, settingsService } from 'core'
import { openBrowser } from '../browser/open'
import { registerShutdownHandlers } from '../lifecycle'

type ProdFetch = StartOptions['fetch']

const createComposedFetch = (apiApp: ReturnType<typeof createApp>, staticDir?: string): ProdFetch => {
  const serveStatic = createStaticHandler(staticDir)

  return async function fetch(request) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api')) {
      return apiApp.fetch(request)
    }

    const staticResponse = await serveStatic(request)
    if (staticResponse) return staticResponse

    return apiApp.fetch(request)
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
    bun run server/src/entry/prod.ts [options]
    bun run prod                    # via root package.json script

  Options:
    --host <host>          Set the host to bind to (default: 127.0.0.1)
    --port, -p <port>      Set the port to listen on (default: 3000)
    --migrations-dir <path> Set the migrations directory
    --no-auto-open         Do not automatically open the browser
    -h, --help             Show this help message
  `
    log.info('prod', 'usage', { usage: usage.trim() })
    return
  }

  const noAutoOpen = hasFlag('--no-auto-open')

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

  const services: AppServices = { projects: projectsService, settings: settingsService }
  const events = createEventBus()

  const apiApp = createApp({ config, services, events })
  const fetch = createComposedFetch(apiApp, config.staticDir)

  const { url, dbFile, migrationsDir: resolvedMigrationsDir } = await startServer({
    config,
    fetch,
    migrationsDir,
  })

  startGithubIssueSyncScheduler({ events })
  startGithubPrAutoCloseScheduler({ events })
  registerShutdownHandlers()

  log.info('prod', 'listening', { url, dbFile, migrationsDir: resolvedMigrationsDir })

  if (!noAutoOpen) {
    openBrowser(url)
  }
}

if (import.meta.main) {
  run().catch((error) => {
    log.error('prod', 'failed to start', { err: error })
    process.exit(1)
  })
}
