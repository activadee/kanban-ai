import pino from 'pino'

const env = () => (typeof Bun !== 'undefined' ? Bun.env : process.env)

const envLevel = env().LOG_LEVEL
const level = envLevel ? envLevel.toLowerCase() : 'info'

export const log = pino({
  level,
  base: { service: 'kanban-ai-server' },
})
