import type {AppEventBus} from '../events/bus'
import {bindTaskEventBus, moveCardToColumnByTitle, createDefaultBoardStructure} from './service'
import {cleanupCardWorkspace} from './cleanup'
import {getColumnById} from '../projects/repo'
import type {AttemptStatus} from 'shared'

export function registerTaskListeners(bus: AppEventBus) {
    bindTaskEventBus(bus)

    bus.subscribe('project.created', async ({projectId}) => {
        try {
            await createDefaultBoardStructure(projectId)
        } catch (error) {
            console.error('[tasks] failed to seed default columns on project.created', error)
        }
    })

    bus.subscribe('attempt.started', async (payload) => {
        try {
            await moveCardToColumnByTitle(payload.boardId, payload.cardId, 'In Progress')
        } catch (error) {
            console.error('[tasks] failed to move card to In Progress on attempt start', error)
        }
    })

    bus.subscribe('attempt.completed', async (payload) => {
        try {
            const status = payload.status as AttemptStatus
            const targetColumn = status === 'succeeded' ? 'Review' : 'In Progress'
            await moveCardToColumnByTitle(payload.boardId, payload.cardId, targetColumn)
        } catch (error) {
            console.error('[tasks] failed to move card to Review on attempt completion', error)
        }
    })

    bus.subscribe('card.moved', async ({boardId, cardId, toColumnId}) => {
        try {
            const column = await getColumnById(toColumnId)
            const title = (column?.title || '').trim().toLowerCase()
            if (title !== 'done') return
            await cleanupCardWorkspace(boardId, cardId)
        } catch (error) {
            console.error('[tasks] failed to cleanup workspace on move to Done', error)
        }
    })
}
