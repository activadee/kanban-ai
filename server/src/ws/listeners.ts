import type {AppEventBus} from '../events/bus'
import {broadcast} from './bus'

export function registerWebSocketListeners(bus: AppEventBus) {
    bus.subscribe('board.state.changed', ({boardId, state}) => {
        broadcast(boardId, JSON.stringify({type: 'state', payload: state}))
    })

    bus.subscribe('attempt.started', ({boardId, attemptId, cardId}) => {
        broadcast(boardId, JSON.stringify({type: 'attempt_started', payload: {attemptId, cardId}}))
    })

    bus.subscribe('attempt.status.changed', ({boardId, attemptId, cardId, status}) => {
        broadcast(boardId, JSON.stringify({type: 'attempt_status', payload: {attemptId, cardId, status}}))
    })

    bus.subscribe('attempt.log.appended', ({boardId, attemptId, level, message, ts}) => {
        broadcast(
            boardId,
            JSON.stringify({type: 'attempt_log', payload: {attemptId, level, message, ts}}),
        )
    })

    bus.subscribe('attempt.conversation.appended', ({boardId, attemptId, item}) => {
        broadcast(boardId, JSON.stringify({type: 'conversation_item', payload: {attemptId, item}}))
    })

    bus.subscribe('attempt.todos.updated', ({boardId, attemptId, todos}) => {
        broadcast(boardId, JSON.stringify({type: 'attempt_todos', payload: {attemptId, todos}}))
    })

    bus.subscribe('attempt.session.recorded', ({boardId, attemptId, sessionId}) => {
        broadcast(boardId, JSON.stringify({type: 'attempt_session', payload: {attemptId, sessionId}}))
    })

    bus.subscribe('attempt.stopped', ({boardId, attemptId}) => {
        const ts = new Date().toISOString()
        const message = 'Attempt stopped by user'
        broadcast(
            boardId,
            JSON.stringify({type: 'attempt_log', payload: {attemptId, level: 'info', message, ts}}),
        )
    })

    bus.subscribe('agent.profile.changed', ({kind, profileId, agent, label}) => {
        broadcast(
            '*',
            JSON.stringify({type: 'agent_profile', payload: {kind, profileId, agent, label: label ?? null}}),
        )
    })

    bus.subscribe('agent.registered', ({agent, label}) => {
        broadcast('*', JSON.stringify({type: 'agent_registered', payload: {agent, label: label ?? null}}))
    })

    bus.subscribe('git.status.changed', ({projectId}) => {
        broadcast(projectId, JSON.stringify({type: 'git:status'}))
    })

    bus.subscribe('git.commit.created', ({projectId, attemptId, shortSha, subject, ts}) => {
        if (attemptId) {
            const message = `[git] committed ${shortSha ? shortSha + ' ' : ''}${subject}`
            broadcast(projectId, JSON.stringify({
                type: 'attempt_log',
                payload: {attemptId, level: 'info', message, ts}
            }))
        }
        broadcast(projectId, JSON.stringify({
            type: 'git_commit',
            payload: {attemptId: attemptId ?? '', shortSha, subject, ts}
        }))
    })

    bus.subscribe('git.push.completed', ({projectId, attemptId, remote, branch, ts}) => {
        if (attemptId) {
            const message = `[git] pushed to ${remote}/${branch}`
            broadcast(projectId, JSON.stringify({
                type: 'attempt_log',
                payload: {attemptId, level: 'info', message, ts}
            }))
        }
        broadcast(projectId, JSON.stringify({
            type: 'git_push',
            payload: {attemptId: attemptId ?? '', remote, branch, ts}
        }))
    })

    bus.subscribe('github.pr.created', ({projectId, attemptId, pr}) => {
        broadcast(projectId, JSON.stringify({type: 'attempt_pr', payload: {attemptId: attemptId ?? '', pr}}))
    })
}
