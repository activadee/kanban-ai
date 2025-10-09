import {useEffect} from 'react'
import {eventBus} from '@/lib/events'

type Status = import('shared').Attempt['status']
type LogPayload = { ts: string; level: string; message: string }
type ConversationItem = import('shared').ConversationItem

export function useAttemptEventStream({
                                          attemptId,
                                          onStatus,
                                          onLog,
                                          onMessage,
                                          onSession,
                                      }: {
    attemptId: string | undefined | null
    onStatus?: (status: Status) => void
    onLog?: (log: LogPayload) => void
    onMessage?: (item: ConversationItem) => void
    onSession?: (sessionId: string) => void
}) {
    useEffect(() => {
        if (!attemptId) return
        const offStatus = eventBus.on('attempt_status', (p) => {
            if (p.attemptId !== attemptId) return
            onStatus?.(p.status)
        })
        const offLog = eventBus.on('attempt_log', (p) => {
            if (p.attemptId !== attemptId) return
            onLog?.({ts: p.ts, level: p.level, message: p.message})
        })
        const offMsg = eventBus.on('conversation_item', (p) => {
            if (p.attemptId !== attemptId) return
            onMessage?.(p.item)
        })
        const offSess = eventBus.on('attempt_session', (p) => {
            if (p.attemptId !== attemptId) return
            if (p.sessionId) onSession?.(p.sessionId)
        })
        return () => {
            offStatus();
            offLog();
            offMsg();
            offSess()
        }
    }, [attemptId, onLog, onMessage, onSession, onStatus])
}

