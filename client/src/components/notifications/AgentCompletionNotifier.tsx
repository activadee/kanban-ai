import {useEffect, useRef} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import type {Attempt, AttemptStatus} from 'shared'

import {useAppSettings} from '@/hooks'
import {eventBus} from '@/lib/events'
import {attemptKeys} from '@/lib/queryClient'
import {getAttempt} from '@/api/attempts'

const FINAL_STATUSES = new Set<AttemptStatus>(['succeeded', 'failed', 'stopped'])

export function AgentCompletionNotifier() {
    const {data: settings} = useAppSettings()
    const queryClient = useQueryClient()
    const statusRef = useRef(new Map<string, AttemptStatus>())
    const attemptRef = useRef(new Map<string, Attempt>())

    useEffect(() => {
        if (!settings?.notificationsDesktop) return
        if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return

        const handleStatus = async ({attemptId, status}: { attemptId: string; status: AttemptStatus }) => {
            const nextStatus = status
            const prevStatus = statusRef.current.get(attemptId)
            statusRef.current.set(attemptId, nextStatus)

            if (!FINAL_STATUSES.has(nextStatus)) return
            if (prevStatus && FINAL_STATUSES.has(prevStatus)) return
            if (window.Notification.permission !== 'granted') return

            let attempt = attemptRef.current.get(attemptId)
            if (!attempt) {
                try {
                    attempt = await queryClient.fetchQuery({
                        queryKey: attemptKeys.detail(attemptId),
                        queryFn: () => getAttempt(attemptId),
                        staleTime: 60_000,
                    })
                    attemptRef.current.set(attemptId, attempt)
                } catch (error) {
                    console.error('Failed to load attempt metadata for notification', error)
                }
            }

            const statusLabel =
                nextStatus === 'succeeded' ? 'completed' : nextStatus === 'failed' ? 'failed' : 'stopped'
            const title = `Agent run ${statusLabel}`
            const bodyLines: string[] = []
            if (attempt?.agent) bodyLines.push(`Agent: ${attempt.agent}`)
            if (attempt?.cardId) bodyLines.push(`Card: ${attempt.cardId.slice(0, 8)}`)
            bodyLines.push(`Attempt: ${attemptId.slice(0, 8)}`)

            try {
                new window.Notification(title, {
                    body: bodyLines.join('\n'),
                    tag: `attempt-${attemptId}`,
                    renotify: true,
                })
            } catch (error) {
                console.error('Failed to display desktop notification', error)
            }
        }

        const unsubscribe = eventBus.on('attempt_status', (payload) => {
            const typed = payload as { attemptId: string; status: AttemptStatus }
            void handleStatus(typed)
        })

        return () => {
            unsubscribe()
        }
    }, [settings?.notificationsDesktop, queryClient])

    return null
}

