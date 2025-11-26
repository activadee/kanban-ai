import {spawn} from 'child_process'
import os from 'os'
import {settingsService} from 'core'
import type {EditorKey, ExecSpec} from './types'
import {buildEditorEnv} from './env'
import {getAdapterForKey} from './detect'
import {pickBinary} from './bin'

const SHELL_CANDIDATES = ['bash', 'zsh', 'sh']

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
                proc.exited
                    .then((code: number) => {
                        if (code !== 0) onFailure()
                    })
                    .catch(() => onFailure())
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

export async function openEditorAtPath(path: string, opts?: {
    editorKey?: EditorKey
}): Promise<{ spec: ExecSpec; env: NodeJS.ProcessEnv }> {
    const settings = settingsService.snapshot()
    const key = opts?.editorKey ?? (settings.editorType as EditorKey | undefined)
    const adapter = getAdapterForKey(key)
    const env = buildEditorEnv(adapter.key)

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

