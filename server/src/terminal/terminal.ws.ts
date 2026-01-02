import {existsSync} from 'node:fs'
import type {ServerWebSocket} from 'bun'
import {terminalService} from './terminal.service'
import {attemptsRepo} from 'core'
import {log} from '../log'
import type {AppEventBus} from '../events/bus'

interface WSData {
    cardId: string
    projectId: string
}

let eventBus: AppEventBus | null = null

export function bindTerminalEventBus(bus: AppEventBus) {
    eventBus = bus
}

export async function handleTerminalWebSocket(
    ws: ServerWebSocket<WSData>,
    cardId: string,
    projectId: string,
) {
    const activeAttempt = await attemptsRepo.getAttemptForCard(projectId, cardId)

    if (!activeAttempt?.worktreePath || !existsSync(activeAttempt.worktreePath)) {
        ws.close(4001, 'No active worktree for this card')
        return
    }

    if (!['running', 'idle', 'succeeded'].includes(activeAttempt.status)) {
        ws.close(4001, 'Attempt is not in a valid state for terminal access')
        return
    }

    let session = terminalService.getSession(cardId)

    if (!session) {
        try {
            session = terminalService.createSession({
                cardId,
                projectId: activeAttempt.boardId,
                attemptId: activeAttempt.id,
                worktreePath: activeAttempt.worktreePath,
            })

            session.pty.onData((data: string) => {
                const message = JSON.stringify({type: 'data', data})
                for (const client of session!.clients) {
                    try {
                        client.send(message)
                    } catch {
                    }
                }
            })

            session.pty.onExit(({exitCode}) => {
                const message = JSON.stringify({type: 'exit', code: exitCode})
                for (const client of session!.clients) {
                    try {
                        client.send(message)
                    } catch {
                    }
                }
                terminalService.destroySession(cardId, 'process_exit')

                if (eventBus) {
                    eventBus.publish('terminal.closed', {
                        projectId: activeAttempt.boardId,
                        cardId,
                        reason: 'process_exit',
                    })
                }
            })

            if (eventBus) {
                eventBus.publish('terminal.opened', {
                    projectId: activeAttempt.boardId,
                    cardId,
                    attemptId: activeAttempt.id,
                    worktreePath: activeAttempt.worktreePath,
                })
            }
        } catch (err) {
            log.error('terminal', 'failed to create session', {cardId, err})
            ws.close(4002, 'Failed to create terminal session')
            return
        }
    }

    terminalService.addClient(cardId, ws)

    ws.data = {cardId, projectId: activeAttempt.boardId}
}

export function handleTerminalMessage(ws: ServerWebSocket<WSData>, message: string | Buffer) {
    const {cardId} = ws.data
    if (!cardId) return

    try {
        const msg = typeof message === 'string' ? message : message.toString()
        const parsed = JSON.parse(msg)

        if (parsed.type === 'data' && typeof parsed.data === 'string') {
            terminalService.write(cardId, parsed.data)
        } else if (parsed.type === 'resize') {
            terminalService.resize(cardId, parsed.cols, parsed.rows)
        }
    } catch {
        const data = typeof message === 'string' ? message : message.toString()
        terminalService.write(cardId, data)
    }
}

export function handleTerminalClose(ws: ServerWebSocket<WSData>) {
    const {cardId, projectId} = ws.data
    if (cardId) {
        const wasDestroyed = terminalService.removeClient(cardId, ws)
        if (wasDestroyed && eventBus) {
            eventBus.publish('terminal.closed', {
                projectId,
                cardId,
                reason: 'disconnect',
            })
        }
    }
}
