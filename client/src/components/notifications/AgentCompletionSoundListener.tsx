import {useEffect, useRef} from 'react'
import type {AttemptStatus} from 'shared'
import {eventBus} from '@/lib/events'
import {playAgentCompletionSound} from '@/lib/sounds'
import {useAppSettings} from '@/hooks'

const DONE_STATUSES: ReadonlySet<AttemptStatus> = new Set(['succeeded', 'failed', 'stopped'])

export function AgentCompletionSoundListener() {
    const {data: settings} = useAppSettings()
    const enabledRef = useRef(Boolean(settings?.notificationsAgentCompletionSound))

    useEffect(() => {
        enabledRef.current = Boolean(settings?.notificationsAgentCompletionSound)
    }, [settings?.notificationsAgentCompletionSound])

    useEffect(() => {
        const completedStatusByAttempt = new Map<string, AttemptStatus>()

        const unsubscribe = eventBus.on('attempt_status', async (payload) => {
            const status = payload.status as AttemptStatus

            if (!DONE_STATUSES.has(status)) {
                completedStatusByAttempt.delete(payload.attemptId)
                return
            }

            const previousStatus = completedStatusByAttempt.get(payload.attemptId)
            if (previousStatus === status) return

            completedStatusByAttempt.set(payload.attemptId, status)

            if (!enabledRef.current) return

            try {
                await playAgentCompletionSound()
            } catch {
                // Ignore playback errors (e.g. autoplay restrictions)
            }
        })

        return () => {
            completedStatusByAttempt.clear()
            unsubscribe()
        }
    }, [])

    return null
}

