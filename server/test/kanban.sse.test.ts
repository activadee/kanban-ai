import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {registerSSEListeners} from '../src/sse/listeners'
import {createEventBus} from '../src/events/bus'
import {addConnection, closeAllConnections, type SSEConnection} from '../src/sse/bus'

function createMockConnection(): SSEConnection {
    return {
        stream: {
            writeSSE: vi.fn(),
        } as any,
        aborted: false,
    }
}

describe('kanban SSE listeners', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        closeAllConnections()
    })

    describe('board state events', () => {
        it('broadcasts state event when board.state.changed fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            const state = {columns: [{id: 'col-1', title: 'Todo', cards: []}]}
            bus.publish('board.state.changed', {boardId: 'board-1', state} as any)

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'state',
                data: JSON.stringify(state),
            })
        })

        it('only broadcasts to matching board channel', () => {
            const bus = createEventBus()
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('board-1', conn1)
            addConnection('board-2', conn2)
            registerSSEListeners(bus)

            bus.publish('board.state.changed', {boardId: 'board-1', state: {}} as any)

            expect(conn1.stream.writeSSE).toHaveBeenCalled()
            expect(conn2.stream.writeSSE).not.toHaveBeenCalled()
        })
    })

    describe('attempt events', () => {
        it('broadcasts attempt_started when attempt.started fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            bus.publish('attempt.started', {boardId: 'board-1', attemptId: 'att-1', cardId: 'card-1'})

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'attempt_started',
                data: JSON.stringify({attemptId: 'att-1', cardId: 'card-1'}),
            })
        })

        it('broadcasts attempt_status when attempt.status.changed fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            bus.publish('attempt.status.changed', {
                boardId: 'board-1',
                attemptId: 'att-1',
                cardId: 'card-1',
                status: 'completed',
            })

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'attempt_status',
                data: JSON.stringify({attemptId: 'att-1', cardId: 'card-1', status: 'completed'}),
            })
        })

        it('broadcasts attempt_log when attempt.log.appended fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            const ts = new Date().toISOString()
            bus.publish('attempt.log.appended', {
                boardId: 'board-1',
                attemptId: 'att-1',
                level: 'info',
                message: 'Test log',
                ts,
            })

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'attempt_log',
                data: JSON.stringify({attemptId: 'att-1', level: 'info', message: 'Test log', ts}),
            })
        })

        it('broadcasts conversation_item when attempt.conversation.appended fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            const item = {type: 'text', role: 'assistant', text: 'Hello'}
            bus.publish('attempt.conversation.appended', {
                boardId: 'board-1',
                attemptId: 'att-1',
                item,
            })

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'conversation_item',
                data: JSON.stringify({attemptId: 'att-1', item}),
            })
        })

        it('broadcasts attempt_todos when attempt.todos.updated fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            const todos = [{id: '1', text: 'Test todo', completed: false}]
            bus.publish('attempt.todos.updated', {
                boardId: 'board-1',
                attemptId: 'att-1',
                todos,
            })

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'attempt_todos',
                data: JSON.stringify({attemptId: 'att-1', todos}),
            })
        })

        it('broadcasts attempt_session when attempt.session.recorded fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            bus.publish('attempt.session.recorded', {
                boardId: 'board-1',
                attemptId: 'att-1',
                sessionId: 'sess-123',
            })

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'attempt_session',
                data: JSON.stringify({attemptId: 'att-1', sessionId: 'sess-123'}),
            })
        })

        it('broadcasts attempt_log when attempt.stopped fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('board-1', conn)
            registerSSEListeners(bus)

            bus.publish('attempt.stopped', {boardId: 'board-1', attemptId: 'att-1'})

            const call = (conn.stream.writeSSE as any).mock.calls[0][0]
            expect(call.event).toBe('attempt_log')
            const payload = JSON.parse(call.data)
            expect(payload.attemptId).toBe('att-1')
            expect(payload.level).toBe('info')
            expect(payload.message).toBe('Attempt stopped by user')
        })
    })

    describe('agent events', () => {
        it('broadcasts agent_profile to all channels when agent.profile.changed fires', () => {
            const bus = createEventBus()
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('board-1', conn1)
            addConnection('board-2', conn2)
            registerSSEListeners(bus)

            bus.publish('agent.profile.changed', {
                kind: 'updated',
                profileId: 'prof-1',
                agent: 'DROID',
                label: 'Custom Profile',
            })

            expect(conn1.stream.writeSSE).toHaveBeenCalled()
            expect(conn2.stream.writeSSE).toHaveBeenCalled()

            const call = (conn1.stream.writeSSE as any).mock.calls[0][0]
            expect(call.event).toBe('agent_profile')
            const payload = JSON.parse(call.data)
            expect(payload).toEqual({
                kind: 'updated',
                profileId: 'prof-1',
                agent: 'DROID',
                label: 'Custom Profile',
            })
        })

        it('broadcasts agent_registered to all channels when agent.registered fires', () => {
            const bus = createEventBus()
            const conn1 = createMockConnection()
            const conn2 = createMockConnection()
            addConnection('board-1', conn1)
            addConnection('board-2', conn2)
            registerSSEListeners(bus)

            bus.publish('agent.registered', {agent: 'CUSTOM', label: 'Custom Agent'})

            expect(conn1.stream.writeSSE).toHaveBeenCalled()
            expect(conn2.stream.writeSSE).toHaveBeenCalled()

            const call = (conn1.stream.writeSSE as any).mock.calls[0][0]
            expect(call.event).toBe('agent_registered')
        })
    })

    describe('git events', () => {
        it('broadcasts git_status when git.status.changed fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('proj-1', conn)
            registerSSEListeners(bus)

            bus.publish('git.status.changed', {projectId: 'proj-1'})

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'git_status',
                data: JSON.stringify({}),
            })
        })

        it('broadcasts git_commit when git.commit.created fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('proj-1', conn)
            registerSSEListeners(bus)

            const ts = new Date().toISOString()
            bus.publish('git.commit.created', {
                projectId: 'proj-1',
                attemptId: 'att-1',
                shortSha: 'abc1234',
                subject: 'Test commit',
                ts,
            })

            const calls = (conn.stream.writeSSE as any).mock.calls
            // Should have attempt_log and git_commit
            expect(calls.length).toBe(2)

            const logCall = calls.find((c: any) => JSON.parse(c[0].data).level === 'info')
            expect(logCall).toBeTruthy()

            const commitCall = calls.find((c: any) => c[0].event === 'git_commit')
            expect(commitCall).toBeTruthy()
            const commitPayload = JSON.parse(commitCall[0].data)
            expect(commitPayload.shortSha).toBe('abc1234')
            expect(commitPayload.subject).toBe('Test commit')
        })

        it('broadcasts git_push when git.push.completed fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('proj-1', conn)
            registerSSEListeners(bus)

            const ts = new Date().toISOString()
            bus.publish('git.push.completed', {
                projectId: 'proj-1',
                attemptId: 'att-1',
                remote: 'origin',
                branch: 'main',
                ts,
            })

            const calls = (conn.stream.writeSSE as any).mock.calls
            const pushCall = calls.find((c: any) => c[0].event === 'git_push')
            expect(pushCall).toBeTruthy()
            const payload = JSON.parse(pushCall[0].data)
            expect(payload.remote).toBe('origin')
            expect(payload.branch).toBe('main')
        })
    })

    describe('github events', () => {
        it('broadcasts attempt_pr when github.pr.created fires', () => {
            const bus = createEventBus()
            const conn = createMockConnection()
            addConnection('proj-1', conn)
            registerSSEListeners(bus)

            const pr = {number: 123, url: 'https://github.com/o/r/pull/123'}
            bus.publish('github.pr.created', {
                projectId: 'proj-1',
                attemptId: 'att-1',
                pr,
            })

            expect(conn.stream.writeSSE).toHaveBeenCalledWith({
                event: 'attempt_pr',
                data: JSON.stringify({attemptId: 'att-1', pr}),
            })
        })
    })
})
