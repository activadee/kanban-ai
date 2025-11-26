import pino from 'pino'
import type { ServerConfig } from './env'
import { getRuntimeConfig } from './env'

const baseConfig = getRuntimeConfig()

export const log = pino({
  level: baseConfig.logLevel,
  base: { service: 'kanban-ai-server' },
})

export const applyLogConfig = (config: Pick<ServerConfig, 'logLevel'>) => {
  log.level = config.logLevel
}
