import {useEffect, useMemo, useRef, useState} from 'react'
import type {BoardState} from 'shared'
import {eventBus} from '@/lib/events'
import {resolveApiBase} from '@/lib/env'

const RECONNECT_BASE_DELAY_MS = 1_500
const RECONNECT_MAX_DELAY_MS = 12_000

export function useKanbanSSE(boardId: string | null) {
    const baseUrl = useMemo(() => {
        // Prefer explicit override
        const explicit = import.meta.env.VITE_SSE_URL as string | undefined
        if (explicit) return explicit.replace(/\/?$/, '')

        // Derive from the API base
        const apiBase = resolveApiBase()
        return apiBase + '/sse'
    }, [])

    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectTimerRef = useRef<number | null>(null)
    const reconnectAttemptsRef = useRef(0)
    const hasHealthyConnectionRef = useRef(false)
    const shouldReconnectRef = useRef(false)

    const [connected, setConnected] = useState(false)
    const [reconnecting, setReconnecting] = useState(false)
    const [state, setState] = useState<BoardState | null>(null)

    useEffect(() => {
        let disposed = false

        function clearReconnectTimer() {
            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
        }

        function clearCurrentConnection() {
            if (eventSourceRef.current) {
                try {
                    eventSourceRef.current.close()
                } catch { /* noop */ }
                eventSourceRef.current = null
            }
        }

        function scheduleReconnect() {
            if (!shouldReconnectRef.current || disposed) return
            if (reconnectTimerRef.current !== null) return
            const attempt = reconnectAttemptsRef.current
            const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS)
            if (hasHealthyConnectionRef.current) {
                setReconnecting(true)
            }
            reconnectTimerRef.current = window.setTimeout(() => {
                reconnectTimerRef.current = null
                if (!shouldReconnectRef.current || disposed) return
                reconnectAttemptsRef.current = Math.min(attempt + 1, 8)
                connect()
            }, delay)
        }

        function handleDisconnect() {
            eventSourceRef.current = null
            setConnected(false)
            scheduleReconnect()
        }

        function handleMessage(event: MessageEvent, eventType: string) {
            if (disposed || !eventSourceRef.current) return
            try {
                const data = JSON.parse(event.data)
                switch (eventType) {
                    case 'state':
                        setState(data)
                        break
                    case 'attempt_started':
                        eventBus.emit('attempt_started', data)
                        break
                    case 'attempt_status':
                        eventBus.emit('attempt_status', data)
                        break
                    case 'attempt_log':
                        eventBus.emit('attempt_log', data)
                        break
                    case 'conversation_item':
                        eventBus.emit('conversation_item', data)
                        break
                    case 'attempt_session':
                        eventBus.emit('attempt_session', data)
                        break
                    case 'attempt_todos':
                        eventBus.emit('attempt_todos', data)
                        break
                    case 'git_status':
                        eventBus.emit('git_status', null)
                        break
                    case 'git_commit':
                        eventBus.emit('git_commit', data)
                        break
                    case 'git_push':
                        eventBus.emit('git_push', data)
                        break
                    case 'attempt_pr':
                        eventBus.emit('attempt_pr', data)
                        break
                    case 'agent_profile':
                        eventBus.emit('agent_profile', data)
                        break
                    case 'agent_registered':
                        eventBus.emit('agent_registered', data)
                        break
                    case 'hello':
                    case 'heartbeat':
                        // Connection management events, no action needed
                        break
                    default:
                        break
                }
            } catch {
                // Ignore parse errors
            }
        }

        shouldReconnectRef.current = false
        clearReconnectTimer()
        clearCurrentConnection()

        if (!boardId) {
            hasHealthyConnectionRef.current = false
            setConnected(false)
            setReconnecting(false)
            setState(null)
            return
        }

        setState(null)
        setReconnecting(false)
        shouldReconnectRef.current = true
        hasHealthyConnectionRef.current = false
        reconnectAttemptsRef.current = 0

        const url = `${baseUrl}?boardId=${encodeURIComponent(boardId)}`

        function connect() {
            if (disposed || !shouldReconnectRef.current) return
            clearReconnectTimer()

            const eventSource = new EventSource(url)
            eventSourceRef.current = eventSource

            eventSource.onopen = () => {
                if (disposed || eventSourceRef.current !== eventSource) return
                reconnectAttemptsRef.current = 0
                hasHealthyConnectionRef.current = true
                setConnected(true)
                setReconnecting(false)
            }

            eventSource.onerror = () => {
                if (disposed) return
                eventSource.close()
                handleDisconnect()
            }

            // Listen for specific event types
            const eventTypes = [
                'hello',
                'state',
                'attempt_started',
                'attempt_status',
                'attempt_log',
                'conversation_item',
                'attempt_session',
                'attempt_todos',
                'git_status',
                'git_commit',
                'git_push',
                'attempt_pr',
                'agent_profile',
                'agent_registered',
                'heartbeat',
            ]

            for (const eventType of eventTypes) {
                eventSource.addEventListener(eventType, (event) => {
                    handleMessage(event as MessageEvent, eventType)
                })
            }
        }

        connect()

        return () => {
            disposed = true
            shouldReconnectRef.current = false
            clearReconnectTimer()
            if (eventSourceRef.current) {
                try {
                    eventSourceRef.current.close()
                } catch { /* noop */ }
                eventSourceRef.current = null
            }
        }
    }, [baseUrl, boardId])

    return {connected, reconnecting, state}
}

/**
 * SSE hook for dashboard - listens to global events (no boardId = dashboard mode)
 */
export function useDashboardSSE() {
    const baseUrl = useMemo(() => {
        const explicit = import.meta.env.VITE_SSE_URL as string | undefined
        if (explicit) return explicit.replace(/\/?$/, '')
        const apiBase = resolveApiBase()
        return apiBase + '/sse'
    }, [])

    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectTimerRef = useRef<number | null>(null)
    const reconnectAttemptsRef = useRef(0)

    const [connected, setConnected] = useState(false)

    useEffect(() => {
        let disposed = false

        function clearReconnectTimer() {
            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
        }

        function scheduleReconnect() {
            if (disposed) return
            if (reconnectTimerRef.current !== null) return
            const attempt = reconnectAttemptsRef.current
            const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS)
            reconnectTimerRef.current = window.setTimeout(() => {
                reconnectTimerRef.current = null
                if (disposed) return
                reconnectAttemptsRef.current = Math.min(attempt + 1, 8)
                connect()
            }, delay)
        }

        function connect() {
            if (disposed) return
            clearReconnectTimer()

            const eventSource = new EventSource(baseUrl)
            eventSourceRef.current = eventSource

            eventSource.onopen = () => {
                if (disposed || eventSourceRef.current !== eventSource) return
                reconnectAttemptsRef.current = 0
                setConnected(true)
            }

            eventSource.onerror = () => {
                if (disposed) return
                eventSource.close()
                eventSourceRef.current = null
                setConnected(false)
                scheduleReconnect()
            }

            // Dashboard events
            eventSource.addEventListener('dashboard_overview', (event) => {
                if (disposed) return
                try {
                    const data = JSON.parse((event as MessageEvent).data)
                    eventBus.emit('dashboard_overview', data)
                } catch { /* ignore */ }
            })

            eventSource.addEventListener('agent_profile', (event) => {
                if (disposed) return
                try {
                    const data = JSON.parse((event as MessageEvent).data)
                    eventBus.emit('agent_profile', data)
                } catch { /* ignore */ }
            })

            eventSource.addEventListener('agent_registered', (event) => {
                if (disposed) return
                try {
                    const data = JSON.parse((event as MessageEvent).data)
                    eventBus.emit('agent_registered', data)
                } catch { /* ignore */ }
            })
        }

        connect()

        return () => {
            disposed = true
            clearReconnectTimer()
            if (eventSourceRef.current) {
                try {
                    eventSourceRef.current.close()
                } catch { /* noop */ }
                eventSourceRef.current = null
            }
        }
    }, [baseUrl])

    return {connected}
}
