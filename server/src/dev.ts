import type { AppEnv } from './env'
import type { UpgradeWebSocket } from 'hono/ws'
import { createApp } from './app'
import { resolveMigrationsFolder, markReady } from './runtime'

if (import.meta.main) {
  const run = async () => {
    const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
    const { createBunWebSocket } = await import('hono/bun')
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
      const usage = `\nkanbanai — KanbanAI server (dev)\n\nUsage:\n  bun run server/src/dev.ts [--host <host>] [--port <port>]\n`
      console.log(usage)
      return
    }

    const port = Number(getArg('--port', '-p') ?? Bun.env.PORT ?? 3000)
    const host = getArg('--host') ?? Bun.env.HOST ?? '127.0.0.1'
    const { db, sqliteDatabase } = await import('./db/client')
    const { registerCoreDbProvider } = await import('./db/provider')
    const migrationsFolder = await resolveMigrationsFolder()
    await migrate(db, { migrationsFolder })
    registerCoreDbProvider()
    const { settingsService } = await import('core')
    try { await settingsService.ensure() } catch (e) { console.warn('[settings] init failed', e) }
    const { upgradeWebSocket, websocket } = createBunWebSocket()
    const app = createApp({ upgradeWebSocket: upgradeWebSocket as UpgradeWebSocket<AppEnv> })
    const server = Bun.serve({ port, hostname: host, fetch: app.fetch, websocket })
    const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`
    const dbFile = sqliteDatabase.filename ?? 'db'
    console.log(`[server] listening on ${url}`)
    console.log(`[server] database: ${dbFile}`)
    markReady()
  }
  run().catch((error) => { console.error('[server] failed to start', error); process.exit(1) })
}
