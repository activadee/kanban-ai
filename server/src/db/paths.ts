import os from 'os'
import path from 'path'
import type { RuntimeEnv, ServerConfig } from '../env'

export const DEFAULT_DB_FILENAME = 'kanban.db'
export const DEV_DB_FILENAME = 'kanban-dev.db'

export const resolveDataDir = (env: RuntimeEnv) => {
  const platform = process.platform
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'kanban-ai')
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA || env.APPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(base, 'kanban-ai')
  }
  const xdg = env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
  return path.join(xdg, 'kanban-ai')
}

export const resolveDefaultDbPath = (config: ServerConfig) => path.join(resolveDataDir(config.env), DEFAULT_DB_FILENAME)
export const resolveDevDbPath = (config: ServerConfig) => path.join(resolveDataDir(config.env), DEV_DB_FILENAME)
