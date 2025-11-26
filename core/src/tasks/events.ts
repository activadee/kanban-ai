import type {AppEventBus} from '../events/bus'
import type {AppEventName, AppEventPayload} from '../events/types'

let taskEvents: AppEventBus | null = null

export function bindTaskEventBus(bus: AppEventBus) {
    taskEvents = bus
}

export function publishTaskEvent<Name extends AppEventName>(name: Name, payload: AppEventPayload<Name>) {
    taskEvents?.publish(name, payload)
}

