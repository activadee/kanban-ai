import {spawn} from 'child_process'
import type {AutomationStage, ConversationAutomationItem} from 'shared'

const OUTPUT_LIMIT = 32768

type RunAutomationCommandOptions = {
    stage: AutomationStage
    command: string
    cwd: string
    env?: Record<string, string | undefined>
    /**
     * Whether to wait for the child process to exit before returning.
     * For long-running dev servers we flip this to false so the HTTP request
     * can respond once the process is considered "ready" instead of timing out.
     */
    waitForExit?: boolean
    /**
     * Optional patterns that indicate the process is ready. Only used when
     * waitForExit is false; falls back to first stdout/stderr chunk.
     */
    readyWhen?: Array<string | RegExp>
    /**
     * How long to wait (ms) for a readiness signal before returning anyway.
     * Only used when waitForExit is false. Default: 5000ms.
     */
    readyTimeoutMs?: number
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

export async function runAutomationCommand({
    stage,
    command,
    cwd,
    env,
    waitForExit = true,
    readyWhen = [],
    readyTimeoutMs = 5000,
}: RunAutomationCommandOptions): Promise<ConversationAutomationItem> {
    const trimmed = command.trim()
    const startedAt = new Date()
    const stdoutBuf = new RollingBuffer(OUTPUT_LIMIT)
    const stderrBuf = new RollingBuffer(OUTPUT_LIMIT)
    let exitCode: number | null = null
    let spawnError: Error | null = null
    let readyReason: 'stdout' | 'stderr' | 'timeout' | null = null
    let outcome: 'exit' | 'ready' | null = null
    let childPid: number | null = null
    const {cmd, args} = resolveShellCommand(trimmed)

    try {
        const child = spawn(cmd, args, {
            cwd,
            env: {...process.env, ...(env ?? {}), KANBANAI_AUTOMATION_STAGE: stage},
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        childPid = child.pid ?? null

        const patterns = readyWhen.map((p) => (typeof p === 'string' ? new RegExp(p) : p))
        let readyResolved = false
        let readyCleanup: () => void = () => {}

        const readyPromise = !waitForExit
            ? new Promise<'ready'>((resolve) => {
                  const timeout = setTimeout(() => {
                      if (readyResolved) return
                      readyResolved = true
                      readyReason = 'timeout'
                      resolve('ready')
                  }, readyTimeoutMs)

                  const checkReady = (chunk: string | Buffer, source: 'stdout' | 'stderr') => {
                      if (readyResolved) return
                      const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
                      const hasSignal = patterns.length
                          ? patterns.some((re) => re.test(str))
                          : str.trim().length > 0
                      if (!hasSignal) return
                      readyResolved = true
                      readyReason = source
                      clearTimeout(timeout)
                      resolve('ready')
                  }

                  const onStdout = (chunk: Buffer | string) => {
                      stdoutBuf.append(chunk)
                      checkReady(chunk, 'stdout')
                  }
                  const onStderr = (chunk: Buffer | string) => {
                      stderrBuf.append(chunk)
                      checkReady(chunk, 'stderr')
                  }

                  child.stdout?.on('data', onStdout)
                  child.stderr?.on('data', onStderr)

                  readyCleanup = () => {
                      clearTimeout(timeout)
                      child.stdout?.off('data', onStdout)
                      child.stderr?.off('data', onStderr)
                  }
              })
            : null

        if (waitForExit) {
            child.stdout?.on('data', (chunk) => stdoutBuf.append(chunk))
            child.stderr?.on('data', (chunk) => stderrBuf.append(chunk))
        }

        const exitPromise = new Promise<'exit'>((resolve) => {
            let resolved = false
            const finalize = (code: number | null) => {
                if (resolved) return
                resolved = true
                exitCode = code
                resolve('exit')
            }
            child.once('close', (code) => finalize(code ?? 0))
            child.once('error', (err) => {
                spawnError = err
                finalize(null)
            })
        })

        outcome = waitForExit
            ? await exitPromise
            : await Promise.race([exitPromise, readyPromise!])

        if (outcome === 'exit') {
            readyCleanup()
            await exitPromise // ensure exitCode populated
        } else {
            readyCleanup()
            // We intentionally do not wait for exit; leave process running.
            exitCode = null
            spawnError = spawnError ?? null
        }
    } catch (error) {
        spawnError = error instanceof Error ? error : new Error(String(error))
    }

    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    if (spawnError && !stderrBuf.toString()) {
        stderrBuf.append(spawnError.message)
    }

    const status: ConversationAutomationItem['status'] = (() => {
        if (spawnError) return 'failed'
        if (!waitForExit && outcome === 'ready') return 'running'
        return exitCode === 0 ? 'succeeded' : 'failed'
    })()

    const metadata = (() => {
        const meta: Record<string, unknown> = {}
        if (spawnError) meta.error = spawnError.message
        if (!waitForExit) {
            if (childPid) meta.pid = childPid
            meta.background = true
            meta.readyReason = readyReason
            meta.readyTimeoutMs = readyTimeoutMs
        }
        return Object.keys(meta).length ? meta : undefined
    })()

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
        metadata: metadata,
    }
}
