import { createApp } from '../app'
import { createWebSocket, startServer, type StartOptions } from '../start'
import { createStaticHandler } from './utils/spa-handler'

const env = () => ((typeof Bun !== 'undefined' ? Bun.env : process.env) as Record<string, string | undefined>)

type ProdFetch = StartOptions['fetch']

const createComposedFetch = (apiApp: ReturnType<typeof createApp>): ProdFetch => {
  const serveStatic = createStaticHandler()

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
    console.log(usage)
    return
  }

  const port = Number(getArg('--port', '-p') ?? env().PORT ?? 3000)
  const host = getArg('--host') ?? env().HOST ?? '127.0.0.1'
  const migrationsDir = getArg('--migrations-dir') ?? env().KANBANAI_MIGRATIONS_DIR

  const { upgradeWebSocket, websocket } = await createWebSocket()
  const apiApp = createApp({ upgradeWebSocket })
  const fetch = createComposedFetch(apiApp)

  const { url, dbFile, migrationsDir: resolvedMigrationsDir } = await startServer({
    host,
    port,
    fetch,
    websocket,
    migrationsDir,
  })

  console.log(`[prod] listening on ${url}`)
  console.log(`[prod] database: ${dbFile}`)
  console.log(`[prod] migrations: ${resolvedMigrationsDir}`)
}

if (import.meta.main) {
  run().catch((error) => {
    console.error('[prod] failed to start', error)
    process.exit(1)
  })
}
