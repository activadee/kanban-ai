import {describe, expect, it} from 'vitest'
import {runAutomationCommand} from '../src/automation/scripts'

describe('runAutomationCommand (dev scripts)', () => {
    it('returns running quickly for long-lived dev commands', async () => {
        const started = Date.now()
        const item = await runAutomationCommand({
            stage: 'dev',
            command: "node -e \"console.log('dev ready'); setTimeout(() => {}, 2000)\"",
            cwd: process.cwd(),
            waitForExit: false,
            readyTimeoutMs: 1000,
        })

        expect(item.status).toBe('running')
        expect(item.exitCode).toBeNull()
        expect(Date.now() - started).toBeLessThan(1500)
        expect(item.metadata && typeof item.metadata.pid === 'number').toBe(true)

        const pid = item.metadata && (item.metadata as any).pid as number | undefined
        if (pid) {
            try {
                process.kill(pid)
            } catch {
                // already exited
            }
        }
    })

    it('surfaces failures when the process exits before readiness window', async () => {
        const item = await runAutomationCommand({
            stage: 'dev',
            command: "node -e \"process.exit(2)\"",
            cwd: process.cwd(),
            waitForExit: false,
            readyTimeoutMs: 500,
        })

        expect(item.status).toBe('failed')
        expect(item.exitCode).toBe(2)
    })
})
