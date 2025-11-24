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
      const usage = `\nkanbanai — KanbanAI server (dev)\n\nUsage:\n  bun run server/src/entry/dev.ts [--host <host>] [--port <port>]\n`
      console.log(usage)
      return
    }

    const port = Number(getArg('--port', '-p') ?? Bun.env.PORT ?? 3000)
    const host = getArg('--host') ?? Bun.env.HOST ?? '127.0.0.1'
    const { upgradeWebSocket, websocket } = await createWebSocket()
    const app = createApp({ upgradeWebSocket })
    const { url, dbFile } = await startServer({ port, host, fetch: app.fetch, websocket })
    console.log(`[server] listening on ${url}`)
    console.log(`[server] database: ${dbFile}`)
  }
  run().catch((error) => {
    console.error('[server] failed to start', error)
    process.exit(1)
  })
}

