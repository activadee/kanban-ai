import path from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import type { AppEnv } from '../env'
import { createApp } from '../app'
import { createWebSocket, startServer } from '../start'

if (import.meta.main) {
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
      const usage = `\nkanbanai — single-binary server (API + UI)\n\nUsage:\n  ./kanban-ai [--host <host>] [--port <port>] [--static-dir <path>] [--migrations-dir <path>]\n\nEnvironment:\n  HOST / PORT                Override listen address (defaults: 0.0.0.0:3000)\n  KANBANAI_STATIC_DIR        Folder containing client-dist (default: ./client-dist)\n  KANBANAI_MIGRATIONS_DIR    Folder containing drizzle migrations (default: ./drizzle)\n`
      console.log(usage)
      return
    }

    const host = getArg('--host') ?? Bun.env.HOST ?? '0.0.0.0'
    const port = Number(getArg('--port', '-p') ?? Bun.env.PORT ?? 3000)
    const staticDir = path.resolve(getArg('--static-dir') ?? Bun.env.KANBANAI_STATIC_DIR ?? 'client-dist')
    const migrationsDir = getArg('--migrations-dir') ?? Bun.env.KANBANAI_MIGRATIONS_DIR

    const indexFile = Bun.file(path.join(staticDir, 'index.html'))
    if (!(await indexFile.exists())) {
      console.warn(`[standalone] warning: client build not found at ${staticDir}. Only API routes will respond.`)
    }

    const { upgradeWebSocket, websocket } = await createWebSocket()
    const api = createApp({ upgradeWebSocket })

    const app = new Hono<AppEnv>()
    // Forward the Bun env so websocket upgrades (upgradeWebSocket) keep working when
    // the API app is nested under this static-serving wrapper.
    const forward = (c: any) => api.fetch(c.req.raw, c.env)
    app.all('/api/*', forward)
    app.all('/api', forward)

    const staticMiddleware = serveStatic({ root: staticDir })
    app.use('/*', staticMiddleware)
    app.get('*', serveStatic({ root: staticDir, path: '/index.html' }))

    const { url, dbFile, migrationsDir: resolvedMigrations } = await startServer({
      host,
      port,
      fetch: app.fetch,
      websocket,
      migrationsDir,
    })

    console.log(`[standalone] listening on ${url}`)
    console.log(`[standalone] database: ${dbFile}`)
    console.log(`[standalone] static dir: ${staticDir}`)
    console.log(`[standalone] migrations dir: ${resolvedMigrations}`)
  }

  run().catch((error) => {
    console.error('[standalone] failed to start', error)
    process.exit(1)
  })
}
