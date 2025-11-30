import {useCallback, useEffect, useMemo, useState} from 'react'
import {useEnhanceTicket} from '@/hooks/projects'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'
import type {TicketType, CardEnhancementSuggestion} from 'shared'
import {
    clearProjectCardEnhancement,
    listProjectEnhancements,
    setProjectCardEnhancement,
    type CardEnhancementEntryResponse,
} from '@/api/projects'

const toSuggestionPayload = (suggestion?: CardEnhancementSuggestion) =>
    suggestion
        ? {
              title: suggestion.title,
              description: suggestion.description,
          }
        : undefined

export type CardEnhancementStatus = 'enhancing' | 'ready'

type CardEnhancementEntry = {
    status: CardEnhancementStatus
    suggestion?: CardEnhancementSuggestion
}

type CardEnhancementState = Record<string, CardEnhancementEntry>


export type StartTicketEnhancementOptions = {
    projectId: string
    cardId: string
    title: string
    description?: string
    ticketType?: TicketType | null
}

export type TicketEnhancementQueue = {
    /**
     * Internal map of enhancement state keyed by cardId.
     * Cards not present in this map are considered "idle".
     */
    enhancements: CardEnhancementState
    /**
     * Convenience lookup that returns the status for a given card,
     * or "idle" when no enhancement is tracked.
     */
    getStatus: (cardId: string) => CardEnhancementStatus | 'idle'
    /**
     * Starts an enhancement job for a newly created card.
     * Uses the provided title/description as the source text.
     */
    startEnhancementForNewCard: (opts: StartTicketEnhancementOptions) => Promise<void>
    /**
     * Starts an enhancement job for an existing card.
     * Uses the latest persisted title/description as the source text.
     */
    startEnhancementForExistingCard: (opts: StartTicketEnhancementOptions) => Promise<void>
    /**
     * Clears any enhancement state (status + suggestion) for the given card.
     * Typically called after Accept/Reject, or when discarding stale suggestions.
     */
    clearEnhancement: (cardId: string) => void
}

export function useTicketEnhancementQueue(projectId?: string): TicketEnhancementQueue {
    const [enhancements, setEnhancements] = useState<CardEnhancementState>({})
    const enhanceMutation = useEnhanceTicket()

    useEffect(() => {
        let cancelled = false
        async function hydrate() {
            if (!projectId) {
                setEnhancements({})
                return
            }
            try {
                const remote = await listProjectEnhancements(projectId)
                if (cancelled) return
                setEnhancements(remote)
            } catch (err) {
                console.error('Failed to load enhancements', err)
                if (!cancelled) {
                    setEnhancements({})
                }
            }
        }
        void hydrate()
        return () => {
            cancelled = true
        }
    }, [projectId])

    const startEnhancement = useCallback(
        async ({projectId, cardId, title, description, ticketType}: StartTicketEnhancementOptions) => {
            const trimmedTitle = title.trim()
            const trimmedDescription = description?.trim() ?? ''
            if (!trimmedTitle) return

            const previousSuggestion = enhancements[cardId]?.suggestion

            setEnhancements((prev) => ({
                ...prev,
                [cardId]: {
                    status: 'enhancing',
                    // Preserve any previous suggestion until the new one is ready;
                    // it will be replaced on success or cleared on error.
                    suggestion: prev[cardId]?.suggestion,
                },
            }))

            if (projectId) {
                const payload: CardEnhancementEntryResponse = {
                    status: 'enhancing',
                    suggestion: toSuggestionPayload(previousSuggestion),
                }
                setProjectCardEnhancement(projectId, cardId, payload).catch((err) => {
                    console.error('Failed to persist enhancement status', err)
                })
            }

            try {
                const result = await enhanceMutation.mutateAsync({
                    projectId,
                    title: trimmedTitle,
                    description: trimmedDescription,
                    ticketType,
                })

                setEnhancements((prev) => ({
                    ...prev,
                    [cardId]: {
                        status: 'ready',
                        suggestion: {
                            title: result.ticket.title,
                            description: result.ticket.description,
                        },
                    },
                }))

                if (projectId) {
                    const payload: CardEnhancementEntryResponse = {
                        status: 'ready',
                        suggestion: {
                            title: result.ticket.title,
                            description: result.ticket.description,
                        },
                    }
                    setProjectCardEnhancement(projectId, cardId, payload).catch((err) => {
                        console.error('Failed to persist enhancement result', err)
                    })
                }
            } catch (err) {
                console.error('Enhance ticket failed', err)
                const {title: errorTitle, description} = describeApiError(err, 'Failed to enhance ticket')
                toast({
                    title: errorTitle,
                    description,
                    variant: 'destructive',
                })

                // Clear enhancement state so the card returns to normal.
                setEnhancements((prev) => {
                    const {[cardId]: _removed, ...rest} = prev
                    return rest
                })

                if (projectId) {
                    clearProjectCardEnhancement(projectId, cardId).catch((error) => {
                        console.error('Failed to clear enhancement after error', error)
                    })
                }
            }
        },
        [enhanceMutation, projectId],
    )

    const startEnhancementForNewCard = useCallback(
        async (opts: StartTicketEnhancementOptions) => {
            await startEnhancement(opts)
        },
        [startEnhancement],
    )

    const startEnhancementForExistingCard = useCallback(
        async (opts: StartTicketEnhancementOptions) => {
            await startEnhancement(opts)
        },
        [startEnhancement],
    )

    const clearEnhancement = useCallback(
        (cardId: string) => {
            setEnhancements((prev) => {
                const {[cardId]: _removed, ...rest} = prev
                return rest
            })

            if (projectId) {
                clearProjectCardEnhancement(projectId, cardId).catch((err) => {
                    console.error('Failed to clear enhancement', err)
                })
            }
        },
        [projectId],
    )

    const getStatus = useCallback(
        (cardId: string): CardEnhancementStatus | 'idle' => {
            const entry = enhancements[cardId]
            return entry?.status ?? 'idle'
        },
        [enhancements],
    )

    return useMemo(
        () => ({
            enhancements,
            getStatus,
            startEnhancementForNewCard,
            startEnhancementForExistingCard,
            clearEnhancement,
        }),
        [enhancements, getStatus, startEnhancementForExistingCard, startEnhancementForNewCard, clearEnhancement],
    )
}
