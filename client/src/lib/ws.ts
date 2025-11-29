import {useEffect, useMemo, useRef, useState} from 'react'
import type {BoardState, WsMsg} from 'shared'
import {eventBus} from '@/lib/events'
import {resolveApiBase} from '@/lib/env'

const HEARTBEAT_INTERVAL_MS = 15_000
const HEARTBEAT_TIMEOUT_MS = 5_000
const RECONNECT_BASE_DELAY_MS = 1_500
const RECONNECT_MAX_DELAY_MS = 12_000

type HeartbeatState = {
    intervalId: number | null
    timeoutId: number | null
    awaitingPong: boolean
    socket: WebSocket | null
}

export function useKanbanWS(boardId: string | null) {
    const baseUrl = useMemo(() => {
        // Prefer explicit override; useful when API and UI are on different hosts/ports.
        const explicit = import.meta.env.VITE_WS_URL as string | undefined
        if (explicit) return explicit.replace(/\/?$/, '')

        // Derive from the API base to keep REST and WS on the same origin/port.
        const apiBase = resolveApiBase()
        return apiBase.replace(/^http/i, 'ws') + '/ws'
    }, [])

    const wsRef = useRef<WebSocket | null>(null)
    const heartbeatRef = useRef<HeartbeatState>({intervalId: null, timeoutId: null, awaitingPong: false, socket: null})
    const reconnectTimerRef = useRef<number | null>(null)
    const reconnectAttemptsRef = useRef(0)
    const hasHealthyConnectionRef = useRef(false)
    const shouldReconnectRef = useRef(false)

    const [connected, setConnected] = useState(false)
    const [reconnecting, setReconnecting] = useState(false)
    const [state, setState] = useState<BoardState | null>(null)

    useEffect(() => {
        let disposed = false

        function clearHeartbeat(ws?: WebSocket | null) {
            const heartbeat = heartbeatRef.current
            if (ws && heartbeat.socket !== ws) return
            if (heartbeat.intervalId !== null) {
                window.clearInterval(heartbeat.intervalId)
                heartbeat.intervalId = null
            }
            if (heartbeat.timeoutId !== null) {
                window.clearTimeout(heartbeat.timeoutId)
                heartbeat.timeoutId = null
            }
            heartbeat.awaitingPong = false
            if (!ws || heartbeat.socket === ws) {
                heartbeat.socket = null
            }
        }

        function clearReconnectTimer() {
            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
        }

        function ackHeartbeat(ws: WebSocket) {
            const heartbeat = heartbeatRef.current
            if (heartbeat.socket !== ws) return
            heartbeat.awaitingPong = false
            if (heartbeat.timeoutId !== null) {
                window.clearTimeout(heartbeat.timeoutId)
                heartbeat.timeoutId = null
            }
        }

        function triggerHeartbeatFailure(ws: WebSocket) {
            const heartbeat = heartbeatRef.current
            if (heartbeat.socket !== ws) return
            clearHeartbeat(ws)
            try {
                ws.close(4001, 'Heartbeat missed')
            } catch { /* noop */
            }
        }

        function sendPing(ws: WebSocket) {
            const heartbeat = heartbeatRef.current
            if (heartbeat.socket !== ws) return
            if (heartbeat.awaitingPong) {
                triggerHeartbeatFailure(ws)
                return
            }
            if (heartbeat.timeoutId !== null) {
                window.clearTimeout(heartbeat.timeoutId)
                heartbeat.timeoutId = null
            }
            const ping: WsMsg = {type: 'ping', payload: {ts: new Date().toISOString()}}
            try {
                ws.send(JSON.stringify(ping))
                heartbeat.awaitingPong = true
                heartbeat.timeoutId = window.setTimeout(() => {
                    triggerHeartbeatFailure(ws)
                }, HEARTBEAT_TIMEOUT_MS)
            } catch {
                triggerHeartbeatFailure(ws)
            }
        }

        function startHeartbeat(ws: WebSocket) {
            clearHeartbeat()
            const heartbeat = heartbeatRef.current
            heartbeat.socket = ws
            heartbeat.awaitingPong = false
            heartbeat.intervalId = window.setInterval(() => sendPing(ws), HEARTBEAT_INTERVAL_MS)
            sendPing(ws)
        }

        function clearCurrentSocket() {
            if (wsRef.current) {
                try {
                    wsRef.current.close()
                } catch { /* noop */
                }
                wsRef.current = null
            }
            clearHeartbeat()
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

        function handleDisconnect(ws: WebSocket) {
            if (wsRef.current === ws) {
                wsRef.current = null
            }
            clearHeartbeat(ws)
            setConnected(false)
            scheduleReconnect()
        }

        function handleMessage(ws: WebSocket, event: MessageEvent) {
            if (disposed || wsRef.current !== ws) return
            try {
                const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)
                const msg = JSON.parse(raw) as WsMsg
                switch (msg.type) {
                    case 'pong':
                        ackHeartbeat(ws)
                        break
                    case 'ping': {
                        const pong: WsMsg = {type: 'pong', payload: {ts: new Date().toISOString()}}
                        ws.send(JSON.stringify(pong))
                        break
                    }
                    case 'attempt_started':
                        eventBus.emit('attempt_started', msg.payload)
                        break
                    case 'state':
                        setState(msg.payload)
                        break
                    case 'attempt_status':
                        eventBus.emit('attempt_status', msg.payload)
                        break
                    case 'attempt_log':
                        eventBus.emit('attempt_log', msg.payload)
                        break
                    case 'conversation_item':
                        eventBus.emit('conversation_item', msg.payload)
                        break
                    case 'attempt_session':
                        eventBus.emit('attempt_session', msg.payload)
                        break
                    case 'attempt_todos':
                        eventBus.emit('attempt_todos', msg.payload)
                        break
                    case 'git:status':
                        eventBus.emit('git_status', null)
                        break
                    case 'git_commit':
                        eventBus.emit('git_commit', msg.payload)
                        break
                    case 'git_push':
                        eventBus.emit('git_push', msg.payload)
                        break
                    case 'attempt_pr':
                        eventBus.emit('attempt_pr', msg.payload)
                        break
                    case 'agent_profile':
                        eventBus.emit('agent_profile', msg.payload)
                        break
                    case 'agent_registered':
                        eventBus.emit('agent_registered', msg.payload)
                        break
                    case 'hello':
                    case 'get_state':
                    case 'create_card':
                    case 'move_card':
                    case 'update_card':
                    case 'delete_card':
                        // handled elsewhere or not expected from server
                        break
                    default:
                        break
                }
            } catch {
                // ignore parse errors
            }
        }

        shouldReconnectRef.current = false
        clearReconnectTimer()
        clearCurrentSocket()

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
            const ws = new WebSocket(url)
            wsRef.current = ws
            setConnected(false)

            ws.addEventListener('open', () => {
                if (disposed || wsRef.current !== ws) return
                reconnectAttemptsRef.current = 0
                hasHealthyConnectionRef.current = true
                setConnected(true)
                setReconnecting(false)
                const requestState: WsMsg = {type: 'get_state'}
                ws.send(JSON.stringify(requestState))
                startHeartbeat(ws)
            })

            ws.addEventListener('close', () => {
                if (disposed) return
                handleDisconnect(ws)
            })

            ws.addEventListener('error', () => {
                if (disposed) return
                handleDisconnect(ws)
            })

            ws.addEventListener('message', (event) => handleMessage(ws, event))
        }

        connect()

        return () => {
            disposed = true
            shouldReconnectRef.current = false
            clearReconnectTimer()
            clearHeartbeat()
            if (wsRef.current) {
                try {
                    wsRef.current.close()
                } catch { /* noop */
                }
                wsRef.current = null
            }
        }
    }, [baseUrl, boardId])

    function send(msg: WsMsg) {
        if (!boardId) return
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify(msg))
    }

    return {connected, reconnecting, state, send}
}
