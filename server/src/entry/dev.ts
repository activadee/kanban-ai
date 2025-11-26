import { createApp } from '../app'
import { createWebSocket, startServer } from '../start'
import { log, applyLogConfig } from '../log'
import { loadConfig, setRuntimeConfig } from '../env'

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
      log.info(usage.trim())
      return
    }

    const baseConfig = loadConfig()
    const port = Number(getArg('--port', '-p') ?? baseConfig.port)
    const host = getArg('--host') ?? baseConfig.host
    const config = {
      ...baseConfig,
      host,
      port: Number.isFinite(port) ? port : baseConfig.port,
    }

    setRuntimeConfig(config)
    applyLogConfig(config)

    const { upgradeWebSocket, websocket } = await createWebSocket()
    const app = createApp({ upgradeWebSocket, config })
    const { url, dbFile } = await startServer({ config, fetch: app.fetch, websocket })
    log.info({ url, dbFile }, '[server] listening')
  }
  run().catch((error) => {
    log.error({ err: error }, '[server] failed to start')
    process.exit(1)
  })
}
