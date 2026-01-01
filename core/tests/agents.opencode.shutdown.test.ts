import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest'

import {OpencodeImpl} from '../src/agents/opencode/core/agent'

describe('OpencodeImpl shutdown functionality', () => {
    beforeEach(() => {
        const serversByPort = (OpencodeImpl as unknown as {serversByPort: Map<number, unknown>}).serversByPort
        serversByPort.clear()
    })

    afterEach(() => {
        const serversByPort = (OpencodeImpl as unknown as {serversByPort: Map<number, unknown>}).serversByPort
        serversByPort.clear()
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

        const serversByPort = (OpencodeImpl as unknown as {serversByPort: Map<number, {close: () => void; url: string; port: number}>}).serversByPort
        serversByPort.set(4097, {close: closeMock1, url: 'http://localhost:4097', port: 4097})
        serversByPort.set(4098, {close: closeMock2, url: 'http://localhost:4098', port: 4098})

        expect(OpencodeImpl.getActiveServerCount()).toBe(2)

        await OpencodeImpl.shutdownAllServers()

        expect(closeMock1).toHaveBeenCalledOnce()
        expect(closeMock2).toHaveBeenCalledOnce()
        expect(OpencodeImpl.getActiveServerCount()).toBe(0)
    })

    it('shutdownAllServers handles errors from close gracefully', async () => {
        const closeMock = vi.fn().mockImplementation(() => {
            throw new Error('close failed')
        })

        const serversByPort = (OpencodeImpl as unknown as {serversByPort: Map<number, {close: () => void; url: string; port: number}>}).serversByPort
        serversByPort.set(4097, {close: closeMock, url: 'http://localhost:4097', port: 4097})

        await expect(OpencodeImpl.shutdownAllServers()).resolves.toBeUndefined()
        expect(closeMock).toHaveBeenCalledOnce()
    })

    it('shutdownAllServers is idempotent when called multiple times', async () => {
        const closeMock = vi.fn()

        const serversByPort = (OpencodeImpl as unknown as {serversByPort: Map<number, {close: () => void; url: string; port: number}>}).serversByPort
        serversByPort.set(4097, {close: closeMock, url: 'http://localhost:4097', port: 4097})

        await OpencodeImpl.shutdownAllServers()
        await OpencodeImpl.shutdownAllServers()

        expect(closeMock).toHaveBeenCalledOnce()
    })
})
