import type {WSContext} from 'hono/ws'
import {getDashboardOverview} from 'core'
import {log} from '../log'
import {addSocket, removeSocket} from './bus'

const CHANNEL_ID = 'dashboard'

function serialize(payload: unknown) {
    return JSON.stringify(payload)
}

export function dashboardWebsocketHandlers() {
    return {
        async onOpen(_evt: Event, ws: WSContext) {
            addSocket(CHANNEL_ID, ws)
            try {
                const overview = await getDashboardOverview()
                ws.send(serialize({type: 'dashboard_overview', payload: overview}))
            } catch (error) {
                log.error({err: error}, '[ws:dashboard] failed to load overview')
            }
        },
        onClose(_evt: CloseEvent, ws: WSContext) {
            removeSocket(CHANNEL_ID, ws)
        },
        onMessage() {
            // Dashboard socket is read-only; ignore incoming messages.
        },
    }
}
