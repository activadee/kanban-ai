import {beforeEach, describe, expect, it, vi} from 'vitest'
import {
    addConnection,
    removeConnection,
    closeAllConnections,
    getConnectionCount,
    broadcast,
    type SSEConnection,
} from '../src/sse/bus'

function createMockConnection(): SSEConnection {
    return {
        stream: {
            writeSSE: vi.fn(),
        } as any,
        aborted: false,
    }
}

describe('SSE bus', () => {
    beforeEach(() => {
        // Clear all connections between tests
        closeAllConnections()
    })

    describe('addConnection/removeConnection', () => {
        it('adds a connection to a channel', () => {
            const conn = createMockConnection()
            addConnection('test-channel', conn)
            expect(getConnectionCount()).toBe(1)
        })

        it('removes a connection from a channel', () => {
            const conn = createMockConnection()
            addConnection('test-channel', conn)
            removeConnection('test-channel', conn)
            expect(getConnectionCount()).toBe(0)
        })

        it('handles removing non-existent connection gracefully', () => {
            const conn = createMockConnection()
            // Should not throw
            removeConnection('non-existent', conn)
            expect(getConnectionCount()).toBe(0)
        })

        it('supports multiple connections per channel', () => {
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('channel-1', conn1)
            addConnection('channel-1', conn2)
            expect(getConnectionCount()).toBe(2)
        })

        it('supports multiple channels', () => {
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('channel-1', conn1)
            addConnection('channel-2', conn2)
            expect(getConnectionCount()).toBe(2)
        })
    })

    describe('closeAllConnections', () => {
        it('marks all connections as aborted and clears them', () => {
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('channel-1', conn1)
            addConnection('channel-2', conn2)

            closeAllConnections()

            expect(conn1.aborted).toBe(true)
            expect(conn2.aborted).toBe(true)
            expect(getConnectionCount()).toBe(0)
        })
    })

    describe('broadcast', () => {
        it('sends message to all connections in a channel', () => {
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('board-1', conn1)
            addConnection('board-1', conn2)

            broadcast('board-1', 'state', {columns: []})

            expect(conn1.stream.writeSSE).toHaveBeenCalledWith({
                event: 'state',
                data: JSON.stringify({columns: []}),
            })
            expect(conn2.stream.writeSSE).toHaveBeenCalledWith({
                event: 'state',
                data: JSON.stringify({columns: []}),
            })
        })

        it('does not send to connections on different channels', () => {
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('board-1', conn1)
            addConnection('board-2', conn2)

            broadcast('board-1', 'state', {columns: []})

            expect(conn1.stream.writeSSE).toHaveBeenCalled()
            expect(conn2.stream.writeSSE).not.toHaveBeenCalled()
        })

        it('skips aborted connections', () => {
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            conn1.aborted = true
            addConnection('board-1', conn1)
            addConnection('board-1', conn2)

            broadcast('board-1', 'state', {columns: []})

            expect(conn1.stream.writeSSE).not.toHaveBeenCalled()
            expect(conn2.stream.writeSSE).toHaveBeenCalled()
        })

        it('marks connection as aborted if writeSSE throws', () => {
            const conn = createMockConnection()
            ;(conn.stream.writeSSE as any).mockImplementation(() => {
                throw new Error('Connection closed')
            })
            addConnection('board-1', conn)

            broadcast('board-1', 'state', {columns: []})

            expect(conn.aborted).toBe(true)
        })

        it('broadcasts to all channels when channelId is "*"', () => {
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            const conn3 = createMockConnection()
            addConnection('board-1', conn1)
            addConnection('board-2', conn2)
            addConnection('dashboard', conn3)

            broadcast('*', 'agent_registered', {agent: 'DROID', label: 'Droid'})

            expect(conn1.stream.writeSSE).toHaveBeenCalled()
            expect(conn2.stream.writeSSE).toHaveBeenCalled()
            expect(conn3.stream.writeSSE).toHaveBeenCalled()
        })

        it('handles broadcast to non-existent channel gracefully', () => {
            // Should not throw
            broadcast('non-existent', 'state', {})
        })
    })
})
