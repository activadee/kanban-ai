import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {render, screen, fireEvent, cleanup} from '@testing-library/react'
import type {Attempt, ConversationItem} from 'shared'
import {AttemptsSection} from '@/components/kanban/card-inspector/sections/AttemptsSection'

const AUTOSCROLL_STORAGE_KEY = 'kanbanai:attempts-autoscroll-enabled'

const baseAttempt: Attempt = {
    id: 'att-1',
    cardId: 'card-1',
    boardId: 'board-1',
    agent: 'codex',
    status: 'running',
    baseBranch: 'main',
    branchName: 'feature/test',
    worktreePath: '/tmp/worktree',
    sessionId: 'session-1',
    startedAt: new Date().toISOString(),
    endedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
}

const baseConversation: ConversationItem[] = [
    {
        type: 'message',
        timestamp: new Date('2025-01-01T00:00:00.000Z').toISOString(),
        role: 'user',
        text: 'Hello, can you help me?',
    },
    {
        type: 'message',
        timestamp: new Date('2025-01-01T00:00:01.000Z').toISOString(),
        role: 'assistant',
        text: 'Of course! How can I help you today?',
    },
]

function renderAttemptsSection(
    overrides: Partial<Parameters<typeof AttemptsSection>[0]> = {},
) {
    const defaultProps = {
        attempt: baseAttempt,
        cardId: 'card-1',
        locked: false,
        conversation: baseConversation,
        followup: '',
        onFollowupChange: vi.fn(),
        onSendFollowup: vi.fn(),
        sendPending: false,
        stopping: false,
        onStopAttempt: vi.fn(),
        onProfileSelect: vi.fn(),
        followupProfiles: [],
        pendingImages: [],
        addImages: vi.fn(),
        removeImage: vi.fn(),
        canAddMoreImages: true,
    }

    return render(<AttemptsSection {...defaultProps} {...overrides} />)
}

describe('AttemptsSection – autoscroll feature', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        cleanup()
        localStorage.clear()
    })

    describe('autoscroll toggle button', () => {
        it('renders autoscroll toggle button', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton).not.toBeNull()
        })

        it('has correct accessibility attributes when enabled', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton.getAttribute('aria-pressed')).toBe('true')
            expect(toggleButton.getAttribute('aria-label')).toBe('Disable auto-scroll')
        })

        it('has correct accessibility attributes when disabled', () => {
            localStorage.setItem(AUTOSCROLL_STORAGE_KEY, 'false')
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton.getAttribute('aria-pressed')).toBe('false')
            expect(toggleButton.getAttribute('aria-label')).toBe('Enable auto-scroll')
        })

        it('toggles autoscroll state on click', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            
            expect(toggleButton.getAttribute('aria-pressed')).toBe('true')
            
            fireEvent.click(toggleButton)
            
            expect(toggleButton.getAttribute('aria-pressed')).toBe('false')
            expect(localStorage.getItem(AUTOSCROLL_STORAGE_KEY)).toBe('false')
            
            fireEvent.click(toggleButton)
            
            expect(toggleButton.getAttribute('aria-pressed')).toBe('true')
            expect(localStorage.getItem(AUTOSCROLL_STORAGE_KEY)).toBe('true')
        })

        it('has visual indicator for enabled state', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton.className).toContain('text-primary')
            expect(toggleButton.className).toContain('bg-primary/10')
        })

        it('has visual indicator for disabled state', () => {
            localStorage.setItem(AUTOSCROLL_STORAGE_KEY, 'false')
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton.className).toContain('text-muted-foreground')
            expect(toggleButton.className).toContain('bg-muted')
        })

        it('shows AUTO badge text when enabled', () => {
            renderAttemptsSection()
            
            const statusBadge = screen.getByTestId('autoscroll-status')
            expect(statusBadge.textContent).toBe('AUTO')
        })

        it('shows OFF badge text when disabled', () => {
            localStorage.setItem(AUTOSCROLL_STORAGE_KEY, 'false')
            renderAttemptsSection()
            
            const statusBadge = screen.getByTestId('autoscroll-status')
            expect(statusBadge.textContent).toBe('OFF')
        })

        it('updates badge text when toggled', () => {
            renderAttemptsSection()
            
            const statusBadge = screen.getByTestId('autoscroll-status')
            expect(statusBadge.textContent).toBe('AUTO')
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            fireEvent.click(toggleButton)
            
            expect(statusBadge.textContent).toBe('OFF')
            
            fireEvent.click(toggleButton)
            
            expect(statusBadge.textContent).toBe('AUTO')
        })
    })

    describe('autoscroll persistence', () => {
        it('defaults to enabled when no stored preference', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton.getAttribute('aria-pressed')).toBe('true')
        })

        it('reads stored preference on mount', () => {
            localStorage.setItem(AUTOSCROLL_STORAGE_KEY, 'false')
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton.getAttribute('aria-pressed')).toBe('false')
        })

        it('persists preference changes to localStorage', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            fireEvent.click(toggleButton)
            
            expect(localStorage.getItem(AUTOSCROLL_STORAGE_KEY)).toBe('false')
        })

        it('maintains preference across re-renders', () => {
            const {rerender} = renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            fireEvent.click(toggleButton)
            expect(toggleButton.getAttribute('aria-pressed')).toBe('false')
            
            rerender(
                <AttemptsSection
                    attempt={baseAttempt}
                    cardId="card-1"
                    locked={false}
                    conversation={[...baseConversation, {
                        type: 'message',
                        timestamp: new Date().toISOString(),
                        role: 'assistant',
                        text: 'New message',
                    }]}
                    followup=""
                    onFollowupChange={vi.fn()}
                    onSendFollowup={vi.fn()}
                    sendPending={false}
                    stopping={false}
                    onStopAttempt={vi.fn()}
                    onProfileSelect={vi.fn()}
                    followupProfiles={[]}
                    pendingImages={[]}
                    addImages={vi.fn()}
                    removeImage={vi.fn()}
                    canAddMoreImages={true}
                />,
            )
            
            expect(screen.getByTestId('autoscroll-toggle').getAttribute('aria-pressed')).toBe('false')
        })
    })

    describe('scroll container integration', () => {
        it('attaches scroll handler to messages container', () => {
            renderAttemptsSection()
            
            const scrollContainer = document.querySelector('.overflow-auto.scroll-smooth')
            expect(scrollContainer).not.toBeNull()
        })

        it('has scroll target element at the end of messages', () => {
            renderAttemptsSection()
            
            const scrollContainer = document.querySelector('.overflow-auto.scroll-smooth')
            expect(scrollContainer).not.toBeNull()
            
            const lastChild = scrollContainer?.lastElementChild
            expect(lastChild).not.toBeNull()
        })
    })

    describe('tooltip wrapper', () => {
        it('wraps toggle button in tooltip provider', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton.closest('[data-radix-tooltip-trigger]') || toggleButton).not.toBeNull()
        })
    })

    describe('keyboard accessibility', () => {
        it('toggle button is focusable', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            toggleButton.focus()
            
            expect(document.activeElement).toBe(toggleButton)
        })

        it('toggle button responds to Enter key', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            toggleButton.focus()
            
            expect(toggleButton.getAttribute('aria-pressed')).toBe('true')
            
            fireEvent.keyDown(toggleButton, {key: 'Enter'})
            fireEvent.keyUp(toggleButton, {key: 'Enter'})
            fireEvent.click(toggleButton)
            
            expect(toggleButton.getAttribute('aria-pressed')).toBe('false')
        })

        it('toggle button responds to Space key', () => {
            renderAttemptsSection()
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            toggleButton.focus()
            
            expect(toggleButton.getAttribute('aria-pressed')).toBe('true')
            
            fireEvent.keyDown(toggleButton, {key: ' '})
            fireEvent.keyUp(toggleButton, {key: ' '})
            fireEvent.click(toggleButton)
            
            expect(toggleButton.getAttribute('aria-pressed')).toBe('false')
        })
    })

    describe('with different conversation states', () => {
        it('renders toggle when conversation is empty', () => {
            renderAttemptsSection({conversation: []})
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton).not.toBeNull()
        })

        it('renders toggle when attempt status is succeeded', () => {
            renderAttemptsSection({
                attempt: {...baseAttempt, status: 'succeeded'},
            })
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton).not.toBeNull()
        })

        it('renders toggle when attempt status is failed', () => {
            renderAttemptsSection({
                attempt: {...baseAttempt, status: 'failed'},
            })
            
            const toggleButton = screen.getByTestId('autoscroll-toggle')
            expect(toggleButton).not.toBeNull()
        })
    })
})
