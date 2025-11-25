import pino from 'pino'

const env = () => (typeof Bun !== 'undefined' ? Bun.env : process.env)

const isFalseyFlag = (value: string) => ['0', 'false', 'off', 'quiet', 'silent'].includes(value)
const matchesDebugNamespace = (value: string) =>
  value.split(/[\s,]+/).some((token) => token === '*' || token.startsWith('kanbanai') || token.startsWith('kanban-ai'))

function computeLevel() {
  const { LOG_LEVEL, KANBANAI_DEBUG, DEBUG } = env()

  if (LOG_LEVEL) return LOG_LEVEL.toLowerCase()

  const kanbanFlag = KANBANAI_DEBUG?.toLowerCase()
  if (kanbanFlag && !isFalseyFlag(kanbanFlag)) return 'debug'

  const debugFlag = DEBUG?.toLowerCase()
  if (debugFlag && !isFalseyFlag(debugFlag) && (matchesDebugNamespace(debugFlag) || ['1', 'true', 'on', 'yes', 'debug', 'verbose', 'trace'].includes(debugFlag))) {
    return 'debug'
  }

  return 'info'
}

export const log = pino({
  level: computeLevel(),
  base: { service: 'kanban-ai-server' },
})
