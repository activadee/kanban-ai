import type {AppEventBus} from '../events/bus'
import {terminalService} from './terminal.service'
import {projectsRepo} from 'core'
import {log} from '../log'

const ELIGIBLE_COLUMNS = new Set(['in progress', 'review'])

function isEligibleColumn(title: string): boolean {
    const normalized = title.toLowerCase().trim()
    return ELIGIBLE_COLUMNS.has(normalized)
}

export function registerTerminalListeners(bus: AppEventBus) {
    bus.subscribe('card.moved', async ({boardId, cardId, toColumnId}) => {
        if (!terminalService.hasSession(cardId)) return

        const column = await projectsRepo.getColumnById(toColumnId)
        const columnTitle = column?.title ?? ''

        if (!isEligibleColumn(columnTitle)) {
            log.info('terminal', 'closing terminal - card moved out of eligible column', {
                cardId,
                columnTitle,
            })
            terminalService.destroySession(cardId, 'card_moved')

            bus.publish('terminal.closed', {
                projectId: boardId,
                cardId,
                reason: 'card_moved',
            })
        }
    })

    bus.subscribe('attempt.status.changed', (event) => {
        const {boardId, cardId, status} = event
        if (!cardId) return
        if (!terminalService.hasSession(cardId)) return

        if (['failed', 'stopped'].includes(status)) {
            log.info('terminal', 'closing terminal - attempt ended', {cardId, status})
            terminalService.destroySession(cardId, 'attempt_ended')

            bus.publish('terminal.closed', {
                projectId: boardId,
                cardId,
                reason: 'attempt_ended',
            })
        }
    })

    bus.subscribe('project.deleted', ({projectId}) => {
        log.info('terminal', 'closing all terminals for deleted project', {projectId})
        terminalService.destroyAllForProject(projectId)
    })
}
