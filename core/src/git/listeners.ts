import type {AppEventBus} from '../events/bus'
import {performAutoCommit} from '../attempts/autocommit'
import {ensureProjectSettings} from '../projects/settings/service'

export function registerGitListeners(bus: AppEventBus) {
    bus.subscribe('attempt.completed', async (payload) => {
        try {
            if (payload.isPlanningAttempt === true) return
            if (payload.status !== 'succeeded') return
            const settings = await ensureProjectSettings(payload.boardId)
            if (!settings.autoCommitOnFinish) return
            bus.publish('attempt.autocommit.requested', {
                attemptId: payload.attemptId,
                boardId: payload.boardId,
                cardId: payload.cardId,
                worktreePath: payload.worktreePath,
                profileId: payload.profileId ?? undefined,
                autoPushOnAutocommit: settings.autoPushOnAutocommit,
                preferredRemote: settings.preferredRemote ?? null,
            })
        } catch (error) {
            console.error('[core:git] auto-commit request failed', error)
        }
    })

    bus.subscribe('attempt.autocommit.requested', async (payload) => {
        try {
            await performAutoCommit({
                attemptId: payload.attemptId,
                boardId: payload.boardId,
                cardId: payload.cardId,
                worktreePath: payload.worktreePath,
                profileId: payload.profileId ?? null,
                autoPushOnAutocommit: payload.autoPushOnAutocommit ?? false,
                preferredRemote: payload.preferredRemote ?? null,
                events: bus,
            })
        } catch (error) {
            console.error('[core:git] auto-commit handler failed', error)
        }
    })
}
