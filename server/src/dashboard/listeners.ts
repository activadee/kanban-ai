import type {AppEventBus} from '../events/bus'
import {broadcast} from '../sse/bus'
import {getDashboardOverview} from 'core'
import {log} from '../log'

const CHANNEL_ID = 'dashboard'

let scheduled = false

function scheduleBroadcast() {
    if (scheduled) return
    scheduled = true
    setTimeout(async () => {
        try {
            const overview = await getDashboardOverview()
            broadcast(CHANNEL_ID, 'dashboard_overview', overview)
        } catch (error) {
            log.error('dashboard', 'broadcast failed', {err: error})
        } finally {
            scheduled = false
        }
    }, 150)
}

export function registerDashboardListeners(bus: AppEventBus) {
    const trigger = () => scheduleBroadcast()

    bus.subscribe('project.created', trigger)
    bus.subscribe('project.updated', trigger)
    bus.subscribe('project.deleted', trigger)

    bus.subscribe('card.created', trigger)
    bus.subscribe('card.updated', trigger)
    bus.subscribe('card.moved', trigger)
    bus.subscribe('card.deleted', trigger)

    bus.subscribe('attempt.queued', trigger)
    bus.subscribe('attempt.started', trigger)
    bus.subscribe('attempt.status.changed', trigger)
    bus.subscribe('attempt.completed', trigger)
    bus.subscribe('attempt.stopped', trigger)
}
