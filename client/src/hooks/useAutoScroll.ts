import {useCallback, useEffect, useRef} from 'react'
import {useLocalStorage} from './useLocalStorage'

export type UseAutoScrollOptions = {
    storageKey?: string
    defaultEnabled?: boolean
    bottomThreshold?: number
    scrollBehavior?: ScrollBehavior
}

export type UseAutoScrollResult = {
    isEnabled: boolean
    toggle: () => void
    enable: () => void
    disable: () => void
    isAtBottom: boolean
    containerRef: React.RefObject<HTMLDivElement | null>
    targetRef: React.RefObject<HTMLDivElement | null>
    scrollToBottom: () => void
    handleScroll: () => void
}

const DEFAULT_STORAGE_KEY = 'kanbanai:autoscroll-enabled'
const DEFAULT_BOTTOM_THRESHOLD = 50

export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollResult {
    const {
        storageKey = DEFAULT_STORAGE_KEY,
        defaultEnabled = true,
        bottomThreshold = DEFAULT_BOTTOM_THRESHOLD,
        scrollBehavior = 'smooth',
    } = options

    const [isEnabled, setIsEnabled] = useLocalStorage(storageKey, defaultEnabled)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const targetRef = useRef<HTMLDivElement | null>(null)
    const isAtBottomRef = useRef(true)
    const wasManuallyDisabledRef = useRef(false)
    const isProgrammaticScrollRef = useRef(false)

    const checkIsAtBottom = useCallback(() => {
        const container = containerRef.current
        if (!container) return true
        
        const {scrollTop, scrollHeight, clientHeight} = container
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight
        return distanceFromBottom <= bottomThreshold
    }, [bottomThreshold])

    const scrollToBottom = useCallback(() => {
        isProgrammaticScrollRef.current = true
        
        const doScroll = () => {
            if (targetRef.current) {
                targetRef.current.scrollIntoView({
                    behavior: scrollBehavior,
                    block: 'end',
                })
            } else if (containerRef.current) {
                containerRef.current.scrollTo({
                    top: containerRef.current.scrollHeight,
                    behavior: scrollBehavior,
                })
            }
        }
        
        doScroll()
        
        const retryIfNeeded = () => {
            if (!checkIsAtBottom()) {
                doScroll()
            }
        }
        
        setTimeout(retryIfNeeded, 100)
        setTimeout(retryIfNeeded, 250)
        
        setTimeout(() => {
            isProgrammaticScrollRef.current = false
            isAtBottomRef.current = true
        }, 300)
    }, [scrollBehavior, checkIsAtBottom])

    const handleScroll = useCallback(() => {
        if (isProgrammaticScrollRef.current) {
            return
        }
        
        const atBottom = checkIsAtBottom()
        const wasAtBottom = isAtBottomRef.current
        isAtBottomRef.current = atBottom

        const userScrolledUp = isEnabled && wasAtBottom && !atBottom
        if (userScrolledUp) {
            wasManuallyDisabledRef.current = true
            setIsEnabled(false)
        }
        
        const userScrolledBackToBottom = !isEnabled && wasManuallyDisabledRef.current && atBottom
        if (userScrolledBackToBottom) {
            wasManuallyDisabledRef.current = false
            setIsEnabled(true)
        }
    }, [isEnabled, setIsEnabled, checkIsAtBottom])

    const toggle = useCallback(() => {
        wasManuallyDisabledRef.current = false
        setIsEnabled((prev) => !prev)
    }, [setIsEnabled])

    const enable = useCallback(() => {
        wasManuallyDisabledRef.current = false
        setIsEnabled(true)
    }, [setIsEnabled])

    const disable = useCallback(() => {
        wasManuallyDisabledRef.current = false
        setIsEnabled(false)
    }, [setIsEnabled])

    return {
        isEnabled,
        toggle,
        enable,
        disable,
        isAtBottom: isAtBottomRef.current,
        containerRef,
        targetRef,
        scrollToBottom,
        handleScroll,
    }
}

export function useAutoScrollEffect(
    isEnabled: boolean,
    scrollToBottom: () => void,
    trigger: unknown,
) {
    const prevTriggerRef = useRef<unknown>(undefined)

    useEffect(() => {
        const triggerChanged = prevTriggerRef.current !== trigger
        prevTriggerRef.current = trigger

        if (isEnabled && triggerChanged) {
            requestAnimationFrame(() => {
                scrollToBottom()
            })
        }
    }, [isEnabled, scrollToBottom, trigger])
}
