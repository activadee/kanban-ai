import {streamSSE} from 'hono/streaming'
import type {AttemptStatus} from 'shared'
import {attemptsRepo, tasks, getDashboardOverview} from 'core'
import {createHandlers} from '../lib/factory'
import {log} from '../log'
import {addConnection, removeConnection, type SSEConnection} from './bus'

const {ensureBoardExists, getBoardState} = tasks
const {listAttemptsForBoard} = attemptsRepo

const HEARTBEAT_INTERVAL_MS = 30_000
const DASHBOARD_CHANNEL = 'dashboard'

async function verifyBoardAccess(boardId: string) {
    await ensureBoardExists(boardId)
}

/**
 * Unified SSE endpoint:
 * - With boardId: subscribes to board-specific events (state, attempts, git)
 * - Without boardId: subscribes to global events (dashboard overview, agents)
 */
export const sseHandlers = createHandlers(async (c) => {
    const boardId = c.req.query('boardId') ?? c.req.query('projectId')

    // Board-specific mode
    if (boardId) {
        try {
            await verifyBoardAccess(boardId)
        } catch (err) {
            log.error('sse', 'Board not found', {boardId, err})
            return c.json({error: 'Board not found'}, 404)
        }

        return streamSSE(c, async (stream) => {
            const conn: SSEConnection = {stream, aborted: false}
            addConnection(boardId, conn)

            stream.onAbort(() => {
                conn.aborted = true
                removeConnection(boardId, conn)
            })

            await stream.writeSSE({
                event: 'hello',
                data: JSON.stringify({serverTime: new Date().toISOString()})
            })

            // Send initial board state
            try {
                const board = await getBoardState(boardId)
                await stream.writeSSE({
                    event: 'state',
                    data: JSON.stringify(board)
                })
            } catch (err) {
                log.error('sse', 'Failed to get board state', {boardId, err})
            }

            // Send recent attempt statuses
            try {
                const recent = await listAttemptsForBoard(boardId)
                for (const attempt of recent) {
                    await stream.writeSSE({
                        event: 'attempt_status',
                        data: JSON.stringify({
                            attemptId: attempt.id,
                            cardId: attempt.cardId,
                            status: attempt.status as AttemptStatus
                        })
                    })
                }
            } catch {
                // Ignore errors loading attempts
            }

            // Keep alive
            while (!conn.aborted) {
                await stream.sleep(HEARTBEAT_INTERVAL_MS)
                if (conn.aborted) break
                try {
                    await stream.writeSSE({
                        event: 'heartbeat',
                        data: JSON.stringify({ts: new Date().toISOString()})
                    })
                } catch {
                    conn.aborted = true
                    break
                }
            }

            removeConnection(boardId, conn)
        })
    }

    // Global/dashboard mode
    return streamSSE(c, async (stream) => {
        const conn: SSEConnection = {stream, aborted: false}
        addConnection(DASHBOARD_CHANNEL, conn)

        stream.onAbort(() => {
            conn.aborted = true
            removeConnection(DASHBOARD_CHANNEL, conn)
        })

        await stream.writeSSE({
            event: 'hello',
            data: JSON.stringify({serverTime: new Date().toISOString()})
        })

        // Send initial dashboard overview
        try {
            const overview = await getDashboardOverview()
            await stream.writeSSE({
                event: 'dashboard_overview',
                data: JSON.stringify(overview)
            })
        } catch (err) {
            log.error('sse', 'Failed to load dashboard overview', {err})
        }

        // Keep alive
        while (!conn.aborted) {
            await stream.sleep(HEARTBEAT_INTERVAL_MS)
            if (conn.aborted) break
            try {
                await stream.writeSSE({
                    event: 'heartbeat',
                    data: JSON.stringify({ts: new Date().toISOString()})
                })
            } catch {
                conn.aborted = true
                break
            }
        }

        removeConnection(DASHBOARD_CHANNEL, conn)
    })
})
