import {describe, expect, it, vi} from 'vitest'
import {isShutdownInProgress, GRACEFUL_SHUTDOWN_TIMEOUT_MS} from '../src/lifecycle'

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

    describe('GRACEFUL_SHUTDOWN_TIMEOUT_MS', () => {
        it('is 5 seconds', () => {
            expect(GRACEFUL_SHUTDOWN_TIMEOUT_MS).toBe(5000)
        })
    })
})
