import type {WSContext} from 'hono/ws'
import type {WsMsg} from 'shared'
import {getDashboardOverview} from 'core'
import {log} from '../log'
import {addSocket, removeSocket} from './bus'

const CHANNEL_ID = 'dashboard'

function serialize(msg: WsMsg) {
    return JSON.stringify(msg)
}

export function dashboardWebsocketHandlers() {
    return {
        async onOpen(_evt: Event, ws: WSContext) {
            addSocket(CHANNEL_ID, ws)
            try {
                const hello: WsMsg = {type: 'hello', payload: {serverTime: new Date().toISOString()}}
                ws.send(serialize(hello))

                const overview = await getDashboardOverview()
                const snapshot: WsMsg = {type: 'dashboard_overview', payload: overview}
                ws.send(serialize(snapshot))
            } catch (error) {
                log.error('ws:dashboard', 'failed to load overview', {err: error})
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
