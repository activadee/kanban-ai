import {spawn} from 'child_process'
import type {AutomationStage, ConversationAutomationItem} from 'shared'

const OUTPUT_LIMIT = 32768

type RunAutomationCommandOptions = {
    stage: AutomationStage
    command: string
    cwd: string
    env?: Record<string, string | undefined>
}

class RollingBuffer {
    private value = ''

    constructor(private readonly limit: number) {}

    append(chunk: string | Buffer | null | undefined) {
        if (!chunk) return
        const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        if (!str) return
        // Preserve trailing output up to limit
        const next = this.value + str
        if (next.length <= this.limit) {
            this.value = next
            return
        }
        this.value = next.slice(next.length - this.limit)
    }

    toString() {
        return this.value
    }
}

function resolveShellCommand(script: string): {cmd: string; args: string[]} {
    if (process.platform === 'win32') {
        return {cmd: 'cmd.exe', args: ['/c', script]}
    }
    const shell = process.env.SHELL && process.env.SHELL.trim().length ? process.env.SHELL : 'bash'
    return {cmd: shell, args: shell.includes('bash') ? ['-lc', script] : ['-lc', script]}
}

export async function runAutomationCommand({stage, command, cwd, env}: RunAutomationCommandOptions): Promise<ConversationAutomationItem> {
    const trimmed = command.trim()
    const startedAt = new Date()
    const stdoutBuf = new RollingBuffer(OUTPUT_LIMIT)
    const stderrBuf = new RollingBuffer(OUTPUT_LIMIT)
    let exitCode: number | null = null
    let spawnError: Error | null = null
    const {cmd, args} = resolveShellCommand(trimmed)

    try {
        const child = spawn(cmd, args, {
            cwd,
            env: {...process.env, ...(env ?? {}), KANBANAI_AUTOMATION_STAGE: stage},
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        child.stdout?.on('data', (chunk) => stdoutBuf.append(chunk))
        child.stderr?.on('data', (chunk) => stderrBuf.append(chunk))

        exitCode = await new Promise<number | null>((resolve) => {
            let resolved = false
            const finalize = (code: number | null) => {
                if (resolved) return
                resolved = true
                resolve(code)
            }
            child.once('close', (code) => finalize(code ?? 0))
            child.once('error', (err) => {
                spawnError = err
                finalize(null)
            })
        })
    } catch (error) {
        spawnError = error instanceof Error ? error : new Error(String(error))
    }

    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    if (spawnError && !stderrBuf.toString()) {
        stderrBuf.append(spawnError.message)
    }

    const status: ConversationAutomationItem['status'] = exitCode === 0 ? 'succeeded' : 'failed'

    return {
        type: 'automation',
        timestamp: completedAt.toISOString(),
        stage,
        command: trimmed,
        cwd,
        status,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        exitCode,
        stdout: stdoutBuf.toString() || null,
        stderr: stderrBuf.toString() || null,
        metadata: spawnError ? {error: spawnError.message} : undefined,
    }
}

