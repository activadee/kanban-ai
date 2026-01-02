import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest'
import {renderHook, act} from '@testing-library/react'
import {useAutoScroll, useAutoScrollEffect} from '@/hooks/useAutoScroll'

const mockScrollIntoView = vi.fn()
const mockScrollTo = vi.fn()

function createMockContainer(overrides: Partial<HTMLDivElement> = {}): HTMLDivElement {
    return {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
        scrollTo: mockScrollTo,
        ...overrides,
    } as HTMLDivElement
}

function createMockTarget(): HTMLDivElement {
    return {
        scrollIntoView: mockScrollIntoView,
    } as unknown as HTMLDivElement
}

describe('useAutoScroll', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
    })

    describe('initial state', () => {
        it('returns enabled by default', () => {
            const {result} = renderHook(() => useAutoScroll())
            expect(result.current.isEnabled).toBe(true)
        })

        it('uses stored preference from localStorage', () => {
            localStorage.setItem('kanbanai:autoscroll-enabled', 'false')
            const {result} = renderHook(() => useAutoScroll())
            expect(result.current.isEnabled).toBe(false)
        })

        it('uses custom storage key', () => {
            localStorage.setItem('custom-key', 'false')
            const {result} = renderHook(() => useAutoScroll({storageKey: 'custom-key'}))
            expect(result.current.isEnabled).toBe(false)
        })

        it('uses custom default when no stored preference exists', () => {
            const {result} = renderHook(() => useAutoScroll({defaultEnabled: false}))
            expect(result.current.isEnabled).toBe(false)
        })
    })

    describe('toggle', () => {
        it('toggles enabled state', () => {
            const {result} = renderHook(() => useAutoScroll())
            
            expect(result.current.isEnabled).toBe(true)
            
            act(() => {
                result.current.toggle()
            })
            
            expect(result.current.isEnabled).toBe(false)
            
            act(() => {
                result.current.toggle()
            })
            
            expect(result.current.isEnabled).toBe(true)
        })

        it('persists toggle state to localStorage', () => {
            const {result} = renderHook(() => useAutoScroll())
            
            act(() => {
                result.current.toggle()
            })
            
            expect(localStorage.getItem('kanbanai:autoscroll-enabled')).toBe('false')
        })
    })

    describe('enable/disable', () => {
        it('enable() sets enabled to true', () => {
            const {result} = renderHook(() => useAutoScroll({defaultEnabled: false}))
            
            expect(result.current.isEnabled).toBe(false)
            
            act(() => {
                result.current.enable()
            })
            
            expect(result.current.isEnabled).toBe(true)
        })

        it('disable() sets enabled to false', () => {
            const {result} = renderHook(() => useAutoScroll())
            
            expect(result.current.isEnabled).toBe(true)
            
            act(() => {
                result.current.disable()
            })
            
            expect(result.current.isEnabled).toBe(false)
        })
    })

    describe('scrollToBottom', () => {
        it('calls scrollIntoView on target ref when available', () => {
            const {result} = renderHook(() => useAutoScroll())
            
            const target = createMockTarget()
            Object.defineProperty(result.current.targetRef, 'current', {
                value: target,
                writable: true,
            })
            
            act(() => {
                result.current.scrollToBottom()
            })
            
            expect(mockScrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'end',
            })
        })

        it('falls back to scrollTo on container when target is not available', () => {
            const {result} = renderHook(() => useAutoScroll())
            
            const container = createMockContainer()
            Object.defineProperty(result.current.containerRef, 'current', {
                value: container,
                writable: true,
            })
            
            act(() => {
                result.current.scrollToBottom()
            })
            
            expect(mockScrollTo).toHaveBeenCalledWith({
                top: 1000,
                behavior: 'smooth',
            })
        })

        it('uses custom scroll behavior', () => {
            const {result} = renderHook(() => useAutoScroll({scrollBehavior: 'auto'}))
            
            const target = createMockTarget()
            Object.defineProperty(result.current.targetRef, 'current', {
                value: target,
                writable: true,
            })
            
            act(() => {
                result.current.scrollToBottom()
            })
            
            expect(mockScrollIntoView).toHaveBeenCalledWith({
                behavior: 'auto',
                block: 'end',
            })
        })
    })

    describe('handleScroll', () => {
        it('disables autoscroll when user scrolls up from bottom', () => {
            const {result} = renderHook(() => useAutoScroll({bottomThreshold: 50}))
            
            const container = createMockContainer({
                scrollTop: 450,
                scrollHeight: 1000,
                clientHeight: 500,
            })
            Object.defineProperty(result.current.containerRef, 'current', {
                value: container,
                writable: true,
            })
            
            expect(result.current.isEnabled).toBe(true)
            
            Object.assign(container, {scrollTop: 100})
            
            act(() => {
                result.current.handleScroll()
            })
            
            expect(result.current.isEnabled).toBe(false)
        })

        it('re-enables autoscroll when user scrolls back to bottom', () => {
            const {result} = renderHook(() => useAutoScroll({bottomThreshold: 50}))
            
            const container = createMockContainer({
                scrollTop: 450,
                scrollHeight: 1000,
                clientHeight: 500,
            })
            Object.defineProperty(result.current.containerRef, 'current', {
                value: container,
                writable: true,
            })
            
            Object.assign(container, {scrollTop: 100})
            act(() => {
                result.current.handleScroll()
            })
            expect(result.current.isEnabled).toBe(false)
            
            Object.assign(container, {scrollTop: 480})
            act(() => {
                result.current.handleScroll()
            })
            expect(result.current.isEnabled).toBe(true)
        })

        it('does not re-enable when manually disabled via toggle', () => {
            const {result} = renderHook(() => useAutoScroll({bottomThreshold: 50}))
            
            const container = createMockContainer({
                scrollTop: 480,
                scrollHeight: 1000,
                clientHeight: 500,
            })
            Object.defineProperty(result.current.containerRef, 'current', {
                value: container,
                writable: true,
            })
            
            act(() => {
                result.current.toggle()
            })
            expect(result.current.isEnabled).toBe(false)
            
            act(() => {
                result.current.handleScroll()
            })
            expect(result.current.isEnabled).toBe(false)
        })

        it('does not disable autoscroll during programmatic scroll', () => {
            vi.useFakeTimers()
            const {result} = renderHook(() => useAutoScroll({bottomThreshold: 50}))
            
            const container = createMockContainer({
                scrollTop: 0,
                scrollHeight: 1000,
                clientHeight: 500,
            })
            Object.defineProperty(result.current.containerRef, 'current', {
                value: container,
                writable: true,
            })
            
            expect(result.current.isEnabled).toBe(true)
            
            act(() => {
                result.current.scrollToBottom()
            })
            
            act(() => {
                result.current.handleScroll()
            })
            
            expect(result.current.isEnabled).toBe(true)
            
            vi.advanceTimersByTime(150)
            vi.useRealTimers()
        })
    })

    describe('refs', () => {
        it('provides containerRef', () => {
            const {result} = renderHook(() => useAutoScroll())
            expect(result.current.containerRef).toBeDefined()
            expect(result.current.containerRef.current).toBeNull()
        })

        it('provides targetRef', () => {
            const {result} = renderHook(() => useAutoScroll())
            expect(result.current.targetRef).toBeDefined()
            expect(result.current.targetRef.current).toBeNull()
        })
    })
})

describe('useAutoScrollEffect', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('scrolls on initial load when autoscroll is enabled', () => {
        const scrollToBottom = vi.fn()
        
        renderHook(() => useAutoScrollEffect(true, scrollToBottom, 1))
        
        vi.runAllTimers()
        
        expect(scrollToBottom).toHaveBeenCalledTimes(1)
        expect(scrollToBottom).toHaveBeenCalledWith(true)
    })

    it('does not scroll on initial load when autoscroll is disabled', () => {
        const scrollToBottom = vi.fn()
        
        renderHook(() => useAutoScrollEffect(false, scrollToBottom, 1))
        
        vi.runAllTimers()
        
        expect(scrollToBottom).not.toHaveBeenCalled()
    })

    it('scrolls when trigger changes and autoscroll is enabled', () => {
        const scrollToBottom = vi.fn()
        let count = 1
        
        const {rerender} = renderHook(() => useAutoScrollEffect(true, scrollToBottom, count))
        
        vi.runAllTimers()
        scrollToBottom.mockClear()
        
        count = 2
        rerender()
        
        vi.runAllTimers()
        
        expect(scrollToBottom).toHaveBeenCalledTimes(1)
        expect(scrollToBottom).toHaveBeenCalledWith(false)
    })

    it('does not scroll when trigger changes but autoscroll is disabled', () => {
        const scrollToBottom = vi.fn()
        let count = 1
        
        const {rerender} = renderHook(() => useAutoScrollEffect(false, scrollToBottom, count))
        
        count = 2
        rerender()
        
        vi.runAllTimers()
        
        expect(scrollToBottom).not.toHaveBeenCalled()
    })

    it('does not scroll when autoscroll is re-enabled but trigger unchanged', () => {
        const scrollToBottom = vi.fn()
        let isEnabled = false
        
        const {rerender} = renderHook(() => useAutoScrollEffect(isEnabled, scrollToBottom, 1))
        
        vi.runAllTimers()
        expect(scrollToBottom).not.toHaveBeenCalled()
        
        isEnabled = true
        rerender()
        
        vi.runAllTimers()
        
        expect(scrollToBottom).not.toHaveBeenCalled()
    })

    it('scrolls when both autoscroll is enabled and trigger changes', () => {
        const scrollToBottom = vi.fn()
        let isEnabled = false
        let count = 1
        
        const {rerender} = renderHook(() => useAutoScrollEffect(isEnabled, scrollToBottom, count))
        
        vi.runAllTimers()
        expect(scrollToBottom).not.toHaveBeenCalled()
        
        isEnabled = true
        count = 2
        rerender()
        
        vi.runAllTimers()
        
        expect(scrollToBottom).toHaveBeenCalledTimes(1)
    })
})
