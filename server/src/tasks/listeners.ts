import type {AppEventBus} from '../events/bus'
import {bindTaskEventBus, moveCardToColumnByTitle, createDefaultBoardStructure} from './service'
import type {AttemptStatus} from 'shared'
import {log} from '../log'

export function registerTaskListeners(bus: AppEventBus) {
    bindTaskEventBus(bus)

    bus.subscribe('project.created', async ({projectId}) => {
        try {
            await createDefaultBoardStructure(projectId)
        } catch (error) {
            log.error('tasks', 'failed to seed default columns on project.created', {err: error, projectId})
        }
    })

    bus.subscribe('attempt.started', async (payload) => {
        try {
            await moveCardToColumnByTitle(payload.boardId, payload.cardId, 'In Progress')
        } catch (error) {
            log.error('tasks', 'failed to move card to In Progress on attempt start', {
                err: error,
                boardId: payload.boardId,
                cardId: payload.cardId,
            })
        }
    })

    bus.subscribe('attempt.completed', async (payload) => {
        try {
            const status = payload.status as AttemptStatus
            const targetColumn = status === 'succeeded' ? 'Review' : 'In Progress'
            await moveCardToColumnByTitle(payload.boardId, payload.cardId, targetColumn)
        } catch (error) {
            log.error('tasks', 'failed to move card to Review on attempt completion', {
                err: error,
                boardId: payload.boardId,
                cardId: payload.cardId,
                status: payload.status,
            })
        }
    })
}
