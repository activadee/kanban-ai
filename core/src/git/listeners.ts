import type {AppEventBus} from '../events/bus'
import {performAutoCommit} from '../attempts/autocommit'

export function registerGitListeners(bus: AppEventBus) {
    bus.subscribe('attempt.autocommit.requested', async (payload) => {
        try {
            await performAutoCommit({
                attemptId: payload.attemptId,
                boardId: payload.boardId,
                cardId: payload.cardId,
                worktreePath: payload.worktreePath,
                profileId: payload.profileId ?? null,
                events: bus,
            })
        } catch (error) {
            console.error('[core:git] auto-commit handler failed', error)
        }
    })
}
