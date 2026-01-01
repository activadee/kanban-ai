import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest'

import {OpencodeImpl} from '../src/agents/opencode/core/agent'
import {OpencodeServerManager} from '../src/agents/opencode/core/server'

describe('OpencodeImpl shutdown functionality', () => {
    beforeEach(() => {
        OpencodeServerManager.clearForTesting()
    })

    afterEach(() => {
        OpencodeServerManager.clearForTesting()
    })

    it('getActiveServerCount returns 0 when no servers running', () => {
        expect(OpencodeImpl.getActiveServerCount()).toBe(0)
    })

    it('isShuttingDown returns false initially', () => {
        expect(OpencodeImpl.isShuttingDown()).toBe(false)
    })

    it('shutdownAllServers resolves immediately when no servers', async () => {
        await expect(OpencodeImpl.shutdownAllServers()).resolves.toBeUndefined()
    })

    it('shutdownAllServers calls close on all registered servers', async () => {
        const closeMock1 = vi.fn()
        const closeMock2 = vi.fn()

        OpencodeServerManager.setServer(4097, {close: closeMock1, url: 'http://localhost:4097', port: 4097})
        OpencodeServerManager.setServer(4098, {close: closeMock2, url: 'http://localhost:4098', port: 4098})

        expect(OpencodeImpl.getActiveServerCount()).toBe(2)

        await OpencodeImpl.shutdownAllServers()

        expect(closeMock1).toHaveBeenCalledOnce()
        expect(closeMock2).toHaveBeenCalledOnce()
        expect(OpencodeImpl.getActiveServerCount()).toBe(0)
    })

    it('shutdownAllServers throws when close fails', async () => {
        const closeMock = vi.fn().mockImplementation(() => {
            throw new Error('close failed')
        })

        OpencodeServerManager.setServer(4097, {close: closeMock, url: 'http://localhost:4097', port: 4097})

        await expect(OpencodeImpl.shutdownAllServers()).rejects.toThrow('Failed to close OpenCode servers')
        expect(closeMock).toHaveBeenCalledOnce()
        expect(OpencodeImpl.getActiveServerCount()).toBe(0)
    })

    it('shutdownAllServers is idempotent when called multiple times', async () => {
        const closeMock = vi.fn()

        OpencodeServerManager.setServer(4097, {close: closeMock, url: 'http://localhost:4097', port: 4097})

        await OpencodeImpl.shutdownAllServers()
        await OpencodeImpl.shutdownAllServers()

        expect(closeMock).toHaveBeenCalledOnce()
    })
})
