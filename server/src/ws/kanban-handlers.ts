import type {WSContext} from 'hono/ws'
import type {AttemptStatus, WsMsg} from 'shared'
import {attemptsRepo, projectDeps, projectsRepo, tasks} from 'core'
import {log} from '../log'
import {addSocket, removeSocket} from './bus'

const {createBoardCard, deleteBoardCard, ensureBoardExists, getBoardState, moveBoardCard, updateBoardCard} = tasks
const {listAttemptsForBoard} = attemptsRepo
const {getCardById, getColumnById} = projectsRepo

const HEARTBEAT_INTERVAL_MS = 15_000
// Allow for background-tab timer throttling (browsers can pause timers to ≥60s).
// Set a generous timeout so healthy background clients are not dropped.
const HEARTBEAT_TIMEOUT_MS = 150_000 // 2.5 minutes

function serialize(msg: WsMsg) {
    return JSON.stringify(msg)
}

export async function verifyBoardAccess(boardId: string) {
    await ensureBoardExists(boardId)
}

export function kanbanWebsocketHandlers(boardId: string) {
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let lastHeartbeatAt = Date.now()

    const stopHeartbeatWatch = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer)
            heartbeatTimer = null
        }
    }

    const startHeartbeatWatch = (ws: WSContext) => {
        stopHeartbeatWatch()
        heartbeatTimer = setInterval(() => {
            if (Date.now() - lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
                stopHeartbeatWatch()
                try {
                    ws.close(4000, 'Heartbeat timeout')
                } catch {
                }
            }
        }, HEARTBEAT_INTERVAL_MS)
    }

    return {
        async onOpen(_evt: Event, ws: WSContext) {
            try {
                await verifyBoardAccess(boardId)
            } catch (err) {
                try {
                    ws.close(1008, 'Board not found')
                } catch {
                }
                return
            }
            addSocket(boardId, ws)
            lastHeartbeatAt = Date.now()
            startHeartbeatWatch(ws)
            ws.send(serialize({type: 'hello', payload: {serverTime: new Date().toISOString()}}))
            const board = await getBoardState(boardId)
            ws.send(serialize({type: 'state', payload: board}))
            // Optionally, send recent attempt statuses/logs for context
            try {
                const recent = await listAttemptsForBoard(boardId)
                for (const attempt of recent) {
                    ws.send(serialize({
                        type: 'attempt_status',
                        payload: {
                            attemptId: attempt.id,
                            cardId: attempt.cardId,
                            status: attempt.status as AttemptStatus
                        }
                    }))
                }
            } catch {
            }
        },
        onClose(_evt: CloseEvent, ws: WSContext) {
            stopHeartbeatWatch()
            removeSocket(boardId, ws)
        },
        async onMessage(event: MessageEvent, ws: WSContext) {
            try {
                const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)
                const msg = JSON.parse(raw) as WsMsg
                lastHeartbeatAt = Date.now()
                switch (msg.type) {
                    case 'ping':
                        ws.send(serialize({type: 'pong', payload: {ts: new Date().toISOString()}}))
                        break
                    case 'pong':
                        break
                    case 'get_state': {
                        const board = await getBoardState(boardId)
                        ws.send(serialize({type: 'state', payload: board}))
                        break
                    }
                    case 'create_card':
                        await createBoardCard(
                            msg.payload.columnId,
                            msg.payload.title,
                            msg.payload.description,
                            msg.payload.ticketType,
                        )
                        break
                    case 'move_card': {
                        // Prevent moving cards out of Done
                        let allowMove = true
                        try {
                            const card = await getCardById(msg.payload.cardId)
                            if (card) {
                                const fromColumn = await getColumnById(card.columnId)
                                const fromTitle = (fromColumn?.title || '').trim().toLowerCase()
                                if (fromTitle === 'done') allowMove = false
                                // Prevent moving blocked cards into In Progress
                                if (allowMove) {
                                    const targetColumn = await getColumnById(msg.payload.toColumnId)
                                    const targetTitle = (targetColumn?.title || '').trim().toLowerCase()
                                    if (targetTitle === 'in progress') {
                                        const {blocked} = await projectDeps.isCardBlocked(msg.payload.cardId)
                                        if (blocked) allowMove = false
                                    }
                                }
                            }
                        } catch {
                        }

                        if (allowMove) {
                            await moveBoardCard(msg.payload.cardId, msg.payload.toColumnId, msg.payload.toIndex)
                        }
                        break
                    }
                    case 'update_card':
                        await updateBoardCard(msg.payload.cardId, {
                            title: msg.payload.title,
                            description: msg.payload.description,
                            ticketType: msg.payload.ticketType,
                            disableAutoCloseOnPRMerge:
                                msg.payload.disableAutoCloseOnPRMerge,
                            isEnhanced: msg.payload.isEnhanced,
                        })
                        break
                    case 'delete_card':
                        await deleteBoardCard(msg.payload.cardId)
                        break
                    default:
                        break
                }
            } catch (error) {
                log.error('ws:message', 'failed', {err: error, boardId})
            }
        },
    }
}
