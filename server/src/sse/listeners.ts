import type {AppEventBus} from '../events/bus'
import {broadcast} from './bus'

export function registerSSEListeners(bus: AppEventBus) {
    bus.subscribe('board.state.changed', ({boardId, state}) => {
        broadcast(boardId, 'state', state)
    })

    bus.subscribe('attempt.started', ({boardId, attemptId, cardId}) => {
        broadcast(boardId, 'attempt_started', {attemptId, cardId})
    })

    bus.subscribe('attempt.status.changed', ({boardId, attemptId, cardId, status}) => {
        broadcast(boardId, 'attempt_status', {attemptId, cardId, status})
    })

    bus.subscribe('attempt.log.appended', ({boardId, attemptId, level, message, ts}) => {
        broadcast(boardId, 'attempt_log', {attemptId, level, message, ts})
    })

    bus.subscribe('attempt.conversation.appended', ({boardId, attemptId, item}) => {
        broadcast(boardId, 'conversation_item', {attemptId, item})
    })

    bus.subscribe('attempt.todos.updated', ({boardId, attemptId, todos}) => {
        broadcast(boardId, 'attempt_todos', {attemptId, todos})
    })

    bus.subscribe('attempt.session.recorded', ({boardId, attemptId, sessionId}) => {
        broadcast(boardId, 'attempt_session', {attemptId, sessionId})
    })

    bus.subscribe('attempt.stopped', ({boardId, attemptId}) => {
        const ts = new Date().toISOString()
        const message = 'Attempt stopped by user'
        broadcast(boardId, 'attempt_log', {attemptId, level: 'info', message, ts})
    })

    bus.subscribe('agent.profile.changed', ({kind, profileId, agent, label}) => {
        broadcast('*', 'agent_profile', {kind, profileId, agent, label: label ?? null})
    })

    bus.subscribe('agent.registered', ({agent, label}) => {
        broadcast('*', 'agent_registered', {agent, label: label ?? null})
    })

    bus.subscribe('git.status.changed', ({projectId}) => {
        broadcast(projectId, 'git_status', {})
    })

    bus.subscribe('git.commit.created', ({projectId, attemptId, shortSha, subject, ts}) => {
        if (attemptId) {
            const message = `[git] committed ${shortSha ? shortSha + ' ' : ''}${subject}`
            broadcast(projectId, 'attempt_log', {attemptId, level: 'info', message, ts})
        }
        broadcast(projectId, 'git_commit', {attemptId: attemptId ?? '', shortSha, subject, ts})
    })

    bus.subscribe('git.push.completed', ({projectId, attemptId, remote, branch, ts}) => {
        if (attemptId) {
            const message = `[git] pushed to ${remote}/${branch}`
            broadcast(projectId, 'attempt_log', {attemptId, level: 'info', message, ts})
        }
        broadcast(projectId, 'git_push', {attemptId: attemptId ?? '', remote, branch, ts})
    })

    bus.subscribe('github.pr.created', ({projectId, attemptId, pr}) => {
        broadcast(projectId, 'attempt_pr', {attemptId: attemptId ?? '', pr})
    })
}
