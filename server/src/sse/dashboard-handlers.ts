import {streamSSE} from 'hono/streaming'
import {getDashboardOverview} from 'core'
import {createHandlers} from '../lib/factory'
import {log} from '../log'
import {addConnection, removeConnection, type SSEConnection} from './bus'

const CHANNEL_ID = 'dashboard'
const HEARTBEAT_INTERVAL_MS = 30_000

export const dashboardSSEHandlers = createHandlers(async (c) => {
    return streamSSE(c, async (stream) => {
        const conn: SSEConnection = {stream, aborted: false}
        addConnection(CHANNEL_ID, conn)

        // Set up abort handler
        stream.onAbort(() => {
            conn.aborted = true
            removeConnection(CHANNEL_ID, conn)
        })

        // Send hello
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
            log.error('sse:dashboard', 'Failed to load overview', {err})
        }

        // Keep connection alive with periodic heartbeats
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

        removeConnection(CHANNEL_ID, conn)
    })
})
