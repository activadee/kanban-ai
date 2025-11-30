import {useCallback, useEffect, useMemo, useState} from 'react'
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

type PersistedCardEnhancementEntry = CardEnhancementEntry & {
    updatedAt: number
}

type PersistedCardEnhancementState = Record<string, PersistedCardEnhancementEntry>

const STORAGE_KEY = 'kanbanai:ticket-enhancements'
const ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const isStorageAvailable = () => typeof window !== 'undefined' && !!window.localStorage

const readPersistedEnhancements = (): PersistedCardEnhancementState => {
    if (!isStorageAvailable()) return {}
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return {}
        return parsed as PersistedCardEnhancementState
    } catch (err) {
        console.warn('Failed to parse enhancement storage, clearing', err)
        window.localStorage.removeItem(STORAGE_KEY)
        return {}
    }
}

const writePersistedEnhancements = (data: PersistedCardEnhancementState) => {
    if (!isStorageAvailable()) return
    try {
        if (Object.keys(data).length === 0) {
            window.localStorage.removeItem(STORAGE_KEY)
            return
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
        console.warn('Failed to write enhancement storage', err)
    }
}

const hydrateEnhancements = (projectId?: string): CardEnhancementState => {
    if (!projectId || !isStorageAvailable()) return {}

    const persisted = readPersistedEnhancements()
    const now = Date.now()
    let dirty = false
    const hydrated: CardEnhancementState = {}

    for (const [key, entry] of Object.entries(persisted)) {
        if (!key.startsWith(`${projectId}:`)) continue

        const cardId = key.slice(projectId.length + 1)
        const expired = !entry?.updatedAt || now - entry.updatedAt > ENTRY_TTL_MS
        const validStatus = entry?.status === 'enhancing' || entry?.status === 'ready'

        if (!cardId || !validStatus || expired) {
            dirty = true
            delete persisted[key]
            continue
        }

        hydrated[cardId] = {
            status: entry.status,
            suggestion: entry.suggestion,
        }
    }

    if (dirty) {
        writePersistedEnhancements(persisted)
    }

    return hydrated
}

const persistEnhancementsForProject = (projectId: string, enhancements: CardEnhancementState) => {
    if (!projectId || !isStorageAvailable()) return

    const existing = readPersistedEnhancements()
    const now = Date.now()
    const next: PersistedCardEnhancementState = {}

    // Keep entries for other projects
    for (const [key, entry] of Object.entries(existing)) {
        if (!key.startsWith(`${projectId}:`)) {
            next[key] = entry
        }
    }

    for (const [cardId, entry] of Object.entries(enhancements)) {
        next[`${projectId}:${cardId}`] = {
            ...entry,
            updatedAt: now,
        }
    }

    writePersistedEnhancements(next)
}

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
    const [enhancements, setEnhancements] = useState<CardEnhancementState>(() => hydrateEnhancements(projectId))
    const enhanceMutation = useEnhanceTicket()

    useEffect(() => {
        setEnhancements(hydrateEnhancements(projectId))
    }, [projectId])

    useEffect(() => {
        if (!projectId) return
        persistEnhancementsForProject(projectId, enhancements)
    }, [projectId, enhancements])

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
