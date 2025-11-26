import {spawn, spawnSync} from 'child_process'
import {existsSync} from 'fs'
import os from 'os'
import {settingsService} from 'core'
import {adapters, PATH_EXT} from './adapters'
import {pickBinary} from './bin'
import type {EditorAdapter, EditorKey, EditorInfo, ExecSpec} from './types'
import {runtimeEnv} from '../env'

const SHELL_CANDIDATES = ['bash', 'zsh', 'sh']

function createDesktopEnv(): NodeJS.ProcessEnv {
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

function trySpawnDetached(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    onFailure?: () => void,
): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bunSpawn = (Bun as any)?.spawn as
        | ((options: { cmd: string[]; env?: NodeJS.ProcessEnv; stdout?: string; stderr?: string; stdin?: string }) => {
        unref?: () => void
        exited: Promise<number>
    })
        | undefined

    if (typeof bunSpawn === 'function') {
        try {
            const proc = bunSpawn({cmd: [command, ...args], env, stdout: 'ignore', stderr: 'ignore', stdin: 'ignore'})
            if (typeof proc.unref === 'function') proc.unref()
            if (onFailure) {
                proc.exited.then((code: number) => {
                    if (code !== 0) onFailure()
                }).catch(() => onFailure())
            }
            return true
        } catch {
            // fall through to Node.js spawn below
        }
    }

    try {
        const child = spawn(command, args, {
            env,
            stdio: 'ignore',
            detached: true,
            windowsHide: process.platform === 'win32',
        })
        child.unref()
        if (onFailure) {
            child.once('error', () => onFailure())
            child.once('exit', (code) => {
                if (typeof code === 'number' && code !== 0) onFailure()
            })
        }
        return true
    } catch {
        if (onFailure) onFailure()
        return false
    }
}

function runShellCommand(line: string, env: NodeJS.ProcessEnv): ExecSpec {
    const platform = os.platform()
    if (platform === 'win32') {
        const args = ['/c', 'start', '', line]
        trySpawnDetached('cmd.exe', args, env)
        return {cmd: 'cmd.exe', args, line}
    }
    const shell = pickBinary(SHELL_CANDIDATES) || '/bin/sh'
    const script = `nohup ${line} >/dev/null 2>&1 & disown`
    const args = ['-lc', script]
    trySpawnDetached(shell, args, env)
    return {cmd: shell, args, line}
}

function getAdapter(key: string | undefined): EditorAdapter {
    const adapter = adapters.find((entry) => entry.key === key)
    if (adapter) return adapter
    if (!adapters.length) {
        throw new Error('No editor adapters registered')
    }
    return adapters[0]!
}

function loadUserSessionEnv(): Record<string, string> | null {
    if (process.platform !== 'linux') return null
    const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
    if (uid === undefined) return null
    try {
        const result = spawnSync('systemctl', ['--user', 'show-environment'], {
            encoding: 'utf8',
            windowsHide: true,
        })
        if (result.status !== 0 || !result.stdout) return null
        const env: Record<string, string> = {}
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

export async function openEditorAtPath(path: string, opts?: {
    editorKey?: EditorKey
}): Promise<{ spec: ExecSpec; env: NodeJS.ProcessEnv }> {
    const settings = settingsService.snapshot()
    const key = opts?.editorKey ?? (settings.editorType as EditorKey | undefined)
    const adapter = getAdapter(key)
    const env = {...createDesktopEnv()}
    env.EDITOR_KEY = adapter.key
    const sessionEnv = loadUserSessionEnv()
    if (sessionEnv) {
        for (const [k, v] of Object.entries(sessionEnv)) {
            if (env[k] == null && v != null) {
                env[k] = v
            }
        }
    }
    const runtimeDir = env.XDG_RUNTIME_DIR || (typeof process.getuid === 'function' ? `/run/user/${process.getuid()}` : undefined)
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

    let fallbackResult: ExecSpec | undefined
    const fallbackLine = adapter.buildFallback(path)

    const runFallback = (): ExecSpec => {
        if (!fallbackResult) {
            fallbackResult = runShellCommand(fallbackLine, env)
        }
        return fallbackResult
    }

    const direct = adapter.buildSpec(path)
    if (direct) {
        const started = trySpawnDetached(direct.cmd, [...direct.args], env, () => runFallback())
        if (fallbackResult) {
            return {spec: fallbackResult, env}
        }
        if (started) {
            return {spec: direct, env}
        }
    }

    const spec = runFallback()
    return {spec, env}
}

export function detectEditors(): EditorInfo[] {
    return adapters.map((adapter) => adapter.detect())
}

export type {EditorKey, EditorInfo, ExecSpec} from './types'
