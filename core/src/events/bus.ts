import {EventEmitter} from 'events'
import type {AppEventHandler, AppEventMap, AppEventName, AppEventPayload} from './types'

export type EventUnsubscribe = () => void

export interface AppEventBus {
    publish<Name extends AppEventName>(name: Name, payload: AppEventPayload<Name>): void

    subscribe<Name extends AppEventName>(name: Name, handler: AppEventHandler<Name>): EventUnsubscribe

    once<Name extends AppEventName>(name: Name, handler: AppEventHandler<Name>): EventUnsubscribe

    removeAllListeners<Name extends AppEventName>(name?: Name): void

    listenerCount<Name extends AppEventName>(name: Name): number
}

function wrapHandler<Name extends AppEventName>(handler: AppEventHandler<Name>): AppEventHandler<Name> {
    return handler
}

export const createEventBus = (): AppEventBus => {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(50)

    const publish = <Name extends AppEventName>(name: Name, payload: AppEventPayload<Name>) => {
        emitter.emit(name, payload)
    }

    const subscribe = <Name extends AppEventName>(name: Name, handler: AppEventHandler<Name>): EventUnsubscribe => {
        const wrapped = wrapHandler(handler)
        emitter.on(name, wrapped)
        return () => {
            emitter.off(name, wrapped)
        }
    }

    const once = <Name extends AppEventName>(name: Name, handler: AppEventHandler<Name>): EventUnsubscribe => {
        const wrapped = wrapHandler(handler)
        emitter.once(name, wrapped)
        return () => {
            emitter.off(name, wrapped)
        }
    }

    const removeAllListeners = <Name extends AppEventName>(name?: Name) => {
        emitter.removeAllListeners(name)
    }

    const listenerCount = <Name extends AppEventName>(name: Name) => emitter.listenerCount(name)

    return {publish, subscribe, once, removeAllListeners, listenerCount}
}

export type CreateEventBusFn = typeof createEventBus

