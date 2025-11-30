import {useCallback, useMemo, useState} from 'react'
import {useEnhanceTicket} from '@/hooks/projects'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'
import type {TicketType} from 'shared'

export type CardEnhancementStatus = 'enhancing' | 'ready'

export type CardEnhancementSuggestion = {
    title: string
    description: string
}

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

export function useTicketEnhancementQueue(): TicketEnhancementQueue {
    const [enhancements, setEnhancements] = useState<CardEnhancementState>({})
    const enhanceMutation = useEnhanceTicket()

    const startEnhancement = useCallback(
        async ({projectId, cardId, title, description, ticketType}: StartTicketEnhancementOptions) => {
            const trimmedTitle = title.trim()
            const trimmedDescription = description?.trim() ?? ''
            if (!trimmedTitle) return

            setEnhancements((prev) => ({
                ...prev,
                [cardId]: {
                    status: 'enhancing',
                    // Preserve any previous suggestion until the new one is ready;
                    // it will be replaced on success or cleared on error.
                    suggestion: prev[cardId]?.suggestion,
                },
            }))

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
            }
        },
        [enhanceMutation],
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

    const clearEnhancement = useCallback((cardId: string) => {
        setEnhancements((prev) => {
            const {[cardId]: _removed, ...rest} = prev
            return rest
        })
    }, [])

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
