import {useEffect} from 'react'
import {eventBus} from '@/lib/events'

type Status = import('shared').Attempt['status']
type LogLevel = import('shared').AttemptLog['level']
type LogPayload = { ts: string; level: LogLevel; message: string }
type ConversationItem = import('shared').ConversationItem
type AttemptTodoSummary = import('shared').AttemptTodoSummary

export function useAttemptEventStream({
                                          attemptId,
                                          onStatus,
                                          onLog,
                                          onMessage,
                                          onSession,
                                          onTodos,
                                      }: {
    attemptId: string | undefined | null
    onStatus?: (status: Status) => void
    onLog?: (log: LogPayload) => void
    onMessage?: (item: ConversationItem) => void
    onSession?: (sessionId: string) => void
    onTodos?: (summary: AttemptTodoSummary) => void
}) {
    useEffect(() => {
        if (!attemptId) return
        const offStatus = eventBus.on('attempt_status', (p) => {
            if (p.attemptId !== attemptId) return
            onStatus?.(p.status as Status)
        })
        const offLog = eventBus.on('attempt_log', (p) => {
            if (p.attemptId !== attemptId) return
            onLog?.({ts: p.ts, level: p.level as LogLevel, message: p.message})
        })
        const offMsg = eventBus.on('conversation_item', (p) => {
            if (p.attemptId !== attemptId) return
            onMessage?.(p.item)
        })
        const offSess = eventBus.on('attempt_session', (p) => {
            if (p.attemptId !== attemptId) return
            if (p.sessionId) onSession?.(p.sessionId)
        })
        const offTodos = eventBus.on('attempt_todos', (p) => {
            if (p.attemptId !== attemptId) return
            onTodos?.(p.todos as AttemptTodoSummary)
        })
        return () => {
            offStatus()
            offLog()
            offMsg()
            offSess()
            offTodos()
        }
    }, [attemptId, onLog, onMessage, onSession, onStatus, onTodos])
}
