import {useState, useCallback, useRef, useEffect} from 'react'
import type {ConversationItem} from 'shared'
import {getAttemptMessages} from '@/api/attempts'

export interface UseAttemptConversationPaginationOptions {
    attemptId: string | undefined
    pageSize?: number
    enabled?: boolean
}

export interface UseAttemptConversationPaginationResult {
    messages: ConversationItem[]
    hasMore: boolean
    isLoading: boolean
    isFetchingMore: boolean
    loadMore: () => Promise<void>
    appendNewMessage: (item: ConversationItem) => void
    reset: () => void
}

export function useAttemptConversationPagination({
    attemptId,
    pageSize = 25,
    enabled = true,
}: UseAttemptConversationPaginationOptions): UseAttemptConversationPaginationResult {
    const [messages, setMessages] = useState<ConversationItem[]>([])
    const [hasMore, setHasMore] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    const isFetchingRef = useRef(false)
    const currentAttemptIdRef = useRef<string | undefined>(undefined)

    // Reset when attemptId changes
    useEffect(() => {
        if (currentAttemptIdRef.current !== attemptId) {
            currentAttemptIdRef.current = attemptId
            setMessages([])
            setHasMore(false)
            setIsLoading(false)
            setIsFetchingMore(false)
            isFetchingRef.current = false
        }
    }, [attemptId])

    // Initial load
    useEffect(() => {
        if (!enabled || !attemptId || messages.length > 0 || isLoading || isFetchingRef.current) {
            return
        }

        const fetchInitial = async () => {
            isFetchingRef.current = true
            setIsLoading(true)

            try {
                const result = await getAttemptMessages(attemptId, pageSize, 0)
                setMessages(result.items)
                setHasMore(result.hasMore)
            } catch (error) {
                console.error('Failed to fetch initial messages:', error)
            } finally {
                setIsLoading(false)
                isFetchingRef.current = false
            }
        }

        fetchInitial()
    }, [enabled, attemptId, messages.length, pageSize, isLoading])

    const loadMore = useCallback(async () => {
        if (!attemptId || !hasMore || isFetchingRef.current) {
            return
        }

        isFetchingRef.current = true
        setIsFetchingMore(true)

        try {
            const offset = messages.length
            const result = await getAttemptMessages(attemptId, pageSize, offset)

            // Prepend older messages (they come before current messages chronologically)
            setMessages((prev) => [...result.items, ...prev])
            setHasMore(result.hasMore)
        } catch (error) {
            console.error('Failed to load more messages:', error)
        } finally {
            setIsFetchingMore(false)
            isFetchingRef.current = false
        }
    }, [attemptId, hasMore, messages.length, pageSize])

    const appendNewMessage = useCallback((item: ConversationItem) => {
        setMessages((prev) => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some((msg) => msg.id === item.id)
            if (exists) return prev
            return [...prev, item]
        })
    }, [])

    const reset = useCallback(() => {
        setMessages([])
        setHasMore(false)
        setIsLoading(false)
        setIsFetchingMore(false)
        isFetchingRef.current = false
    }, [])

    return {
        messages,
        hasMore,
        isLoading,
        isFetchingMore,
        loadMore,
        appendNewMessage,
        reset,
    }
}
