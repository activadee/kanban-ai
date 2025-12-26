import {spawn} from 'child_process'
import {settingsService} from 'core'
import type {ExecSpec} from './types'

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

export async function openEditorAtPath(
    targetPath: string,
    opts?: { editorCommand?: string }
): Promise<{ spec: ExecSpec; env: NodeJS.ProcessEnv } | null> {
    const settings = settingsService.snapshot()
    const editorCommand = opts?.editorCommand ?? settings.editorCommand

    if (!editorCommand?.trim()) {
        return null
    }

    const env = {...process.env}
    const args = [targetPath]
    const line = `${editorCommand} ${targetPath}`

    trySpawnDetached(editorCommand, args, env)

    return {
        spec: {cmd: editorCommand, args, line},
        env,
    }
}

