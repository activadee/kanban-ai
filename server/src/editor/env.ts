import {spawnSync} from 'child_process'
import {existsSync} from 'fs'
import {PATH_EXT} from './adapters'
import type {EditorKey} from './types'
import {runtimeEnv} from '../env'

export type SessionEnv = Record<string, string>

export function createDesktopEnv(): NodeJS.ProcessEnv {
    const baseEnv = runtimeEnv()
    const env: NodeJS.ProcessEnv = {
        ...baseEnv,
        PATH: baseEnv.PATH ? `${baseEnv.PATH}:${PATH_EXT}` : PATH_EXT,
    }
    const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
    const runtimeDir = uid !== undefined ? `/run/user/${uid}` : undefined
    if (!env.XDG_RUNTIME_DIR && runtimeDir && existsSync(runtimeDir)) {
        env.XDG_RUNTIME_DIR = runtimeDir
    }
    if (!env.DBUS_SESSION_BUS_ADDRESS && runtimeDir && existsSync(`${runtimeDir}/bus`)) {
        env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${runtimeDir}/bus`
    }
    if (!env.DISPLAY && process.platform !== 'win32') {
        env.DISPLAY = ':0'
    }
    return env
}

export function loadUserSessionEnv(): SessionEnv | null {
    if (process.platform !== 'linux') return null
    const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
    if (uid === undefined) return null
    try {
        const result = spawnSync('systemctl', ['--user', 'show-environment'], {
            encoding: 'utf8',
            windowsHide: true,
        })
        if (result.status !== 0 || !result.stdout) return null
        const env: SessionEnv = {}
        for (const line of result.stdout.split(/\r?\n/)) {
            if (!line) continue
            const idx = line.indexOf('=')
            if (idx === -1) continue
            const key = line.slice(0, idx)
            const value = line.slice(idx + 1)
            if (key) env[key] = value
        }
        return env
    } catch {
        return null
    }
}

export function applySessionEnv(baseEnv: NodeJS.ProcessEnv, sessionEnv: SessionEnv | null): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {...baseEnv}
    if (sessionEnv) {
        for (const [k, v] of Object.entries(sessionEnv)) {
            if (env[k] == null && v != null) {
                env[k] = v
            }
        }
    }
    const runtimeDir =
        env.XDG_RUNTIME_DIR ||
        (typeof process.getuid === 'function' ? `/run/user/${process.getuid()}` : undefined)
    if (!env.WAYLAND_DISPLAY && runtimeDir) {
        const waylandSock = `${runtimeDir}/wayland-0`
        if (existsSync(waylandSock)) {
            env.WAYLAND_DISPLAY = 'wayland-0'
        }
    }
    if (!env.DBUS_SESSION_BUS_ADDRESS && runtimeDir && existsSync(`${runtimeDir}/bus`)) {
        env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${runtimeDir}/bus`
    }
    if (!env.DISPLAY && sessionEnv?.DISPLAY) {
        env.DISPLAY = sessionEnv.DISPLAY
    }
    return env
}

export function buildEditorEnv(editorKey: EditorKey): NodeJS.ProcessEnv {
    const baseEnv = createDesktopEnv()
    const sessionEnv = loadUserSessionEnv()
    const env = applySessionEnv(baseEnv, sessionEnv)
    env.EDITOR_KEY = editorKey
    return env
}

