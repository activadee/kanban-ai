import type {AppEventBus} from '../events/bus'
import {bindTaskEventBus, moveCardToColumnByTitle, createDefaultBoardStructure} from './service'
import {cleanupCardWorkspace} from './cleanup'
import {getColumnById} from '../projects/repo'
import {ensureProjectSettings} from '../projects/settings/service'
import {ensureAppSettings, getAppSettingsSnapshot} from '../settings/service'
import {getLatestAttemptForCard, startAttempt} from '../attempts/service'
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
            if (payload.isPlanningAttempt === true) return
            await moveCardToColumnByTitle(payload.boardId, payload.cardId, 'In Progress')
        } catch (error) {
            console.error('[tasks] failed to move card to In Progress on attempt start', error)
        }
    })

    bus.subscribe('attempt.completed', async (payload) => {
        try {
            if (payload.isPlanningAttempt === true) return
            const status = payload.status as AttemptStatus
            const targetColumn = status === 'succeeded' ? 'Review' : 'In Progress'
            await moveCardToColumnByTitle(payload.boardId, payload.cardId, targetColumn)
        } catch (error) {
            console.error('[tasks] failed to move card to Review on attempt completion', error)
        }
    })

    bus.subscribe('card.moved', async ({boardId, cardId, fromColumnId, toColumnId}) => {
        try {
            const toColumn = await getColumnById(toColumnId)
            const toTitle = (toColumn?.title || '').trim().toLowerCase()

            // Workspace cleanup when moving cards into Done
            if (toTitle === 'done') {
                await cleanupCardWorkspace(boardId, cardId)
            }

            // Auto‑start agent when moving from Backlog → In Progress
            await ensureAppSettings()
            const settings = getAppSettingsSnapshot()
            if (!settings.autoStartAgentOnInProgress) return

            const fromColumn = await getColumnById(fromColumnId)
            const fromTitle = (fromColumn?.title || '').trim().toLowerCase()

            if (fromTitle !== 'backlog' || toTitle !== 'in progress') return

            const projectSettings = await ensureProjectSettings(boardId)
            const agentKey = projectSettings.defaultAgent
            if (!agentKey) return

            const existing = await getLatestAttemptForCard(boardId, cardId)
            const existingStatus = existing?.attempt?.status as AttemptStatus | undefined
            if (existingStatus && ['running', 'queued', 'stopping'].includes(existingStatus)) return

            await startAttempt(
                {
                    boardId,
                    cardId,
                    agent: agentKey,
                    profileId: projectSettings.defaultProfileId ?? undefined,
                },
                {events: bus},
            )
        } catch (error) {
            console.error('[tasks] failed to handle card.moved', error)
        }
    })
}
