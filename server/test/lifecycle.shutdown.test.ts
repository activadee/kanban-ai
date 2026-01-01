import {describe, expect, it, vi} from 'vitest'
import {isShutdownInProgress, getExitCode, GRACEFUL_SHUTDOWN_TIMEOUT_MS} from '../src/lifecycle'

vi.mock('core', () => ({
    shutdownOpencodeServers: vi.fn().mockResolvedValue(undefined),
    getOpencodeServerCount: vi.fn().mockReturnValue(0),
}))

describe('lifecycle shutdown', () => {
    describe('isShutdownInProgress', () => {
        it('returns false initially', () => {
            expect(isShutdownInProgress()).toBe(false)
        })
    })

    describe('getExitCode', () => {
        it('returns 0 initially', () => {
            expect(getExitCode()).toBe(0)
        })
    })

    describe('GRACEFUL_SHUTDOWN_TIMEOUT_MS', () => {
        it('is 5 seconds', () => {
            expect(GRACEFUL_SHUTDOWN_TIMEOUT_MS).toBe(5000)
        })
    })
})
