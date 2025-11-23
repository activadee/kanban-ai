import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { dbSchema } from "core";
import os from "os";
import path from "path";
import fs from "fs";

function dataDir() {
    const platform = process.platform
    if (platform === "darwin") {
        return path.join(os.homedir(), "Library", "Application Support", "KanbanAI")
    }
    if (platform === "win32") {
        const base = process.env.LOCALAPPDATA || process.env.APPDATA || path.join(os.homedir(), "AppData", "Local")
        return path.join(base, "KanbanAI")
    }
    const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
    return path.join(xdg, "kanbanai")
}

function envDbPath(): string | undefined {
    const raw = Bun.env.DATABASE_URL ?? process.env.DATABASE_URL
    if (!raw) return undefined
    if (raw === ':memory:') return raw

    // Preserve URI when query params or options are present
    const hasQuery = raw.includes('?')
    const isUri = raw.startsWith('file:') || raw.startsWith('sqlite:')
    if (isUri) {
        if (hasQuery) return raw
        try {
            const url = new URL(raw)
            const filePath = url.pathname
            const normalized = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
            return normalized
        } catch {
            return raw
        }
    }

    return raw
}

const dbPath = (() => {
    const fromEnv = envDbPath()
    if (fromEnv) {
        if (fromEnv.startsWith('file:') || fromEnv.startsWith('sqlite:')) return fromEnv
        return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv)
    }
    return path.join(dataDir(), "kanban.db")
})()

// Ensure directory exists
if (dbPath !== ':memory:') {
    try {
        const dir = path.dirname(dbPath)
        fs.mkdirSync(dir, {recursive: true})
    } catch {
    }
}

const sqlite = new Database(dbPath, {create: true});
sqlite.run("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, {schema: dbSchema as any});
export type DbClient = typeof db;

export {sqlite as sqliteDatabase};
