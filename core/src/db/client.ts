import {drizzle} from 'drizzle-orm/bun-sqlite'
import {Database} from 'bun:sqlite'
import * as schema from './schema'
import os from 'os'
import path from 'path'
import fs from 'fs'

function dataDir() {
    const platform = process.platform
    if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'KanbanAI')
    }
    if (platform === 'win32') {
        const base = process.env.LOCALAPPDATA || process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Local')
        return path.join(base, 'KanbanAI')
    }
    const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
    return path.join(xdg, 'kanbanai')
}

const dbPath = path.join(dataDir(), 'kanban.db')

// Ensure directory exists
try {
    const dir = path.dirname(dbPath)
    fs.mkdirSync(dir, {recursive: true})
} catch {
}

const sqlite = new Database(dbPath, {create: true})
sqlite.run('PRAGMA foreign_keys = ON;')

export const db = drizzle(sqlite, {schema})
export type DbClient = typeof db

export {sqlite as sqliteDatabase}

