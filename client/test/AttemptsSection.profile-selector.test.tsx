import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {render, screen, cleanup, within, fireEvent, waitFor} from '@testing-library/react'
import type {Attempt, ConversationItem, AgentKey} from 'shared'
import {AttemptsSection} from '@/components/kanban/card-inspector/sections/AttemptsSection'

const baseAttempt: Attempt = {
    id: 'att-1',
    cardId: 'card-1',
    boardId: 'board-1',
    agent: 'codex' as AgentKey,
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
        text: 'Hello',
    },
]

const mockProfiles = [
    {id: 'prof-1', name: 'Default Profile'},
    {id: 'prof-2', name: 'High-Performance Optimized Profile'},
    {id: 'prof-3', name: 'Debug Mode with Extended Logging'},
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
        attemptAgent: 'codex' as AgentKey,
        ...overrides,
    }

    return render(<AttemptsSection {...defaultProps} />)
}

describe('AttemptsSection – profile selector transparency', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Element.prototype.scrollIntoView = vi.fn()
    })

    afterEach(() => {
        cleanup()
    })

    describe('profile selector rendering', () => {
        it('renders profile selector when profiles are available', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            expect(trigger).toBeInTheDocument()
        })

        it('does not render profile selector when no profiles available', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: [],
            })

            const trigger = screen.queryByRole('combobox', {hidden: true})
            expect(trigger).toBeNull()
        })

        it('does not render profile selector when no agent specified', () => {
            renderAttemptsSection({
                attemptAgent: undefined,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.queryByRole('combobox', {hidden: true})
            expect(trigger).toBeNull()
        })
    })

    describe('transparent background styling', () => {
        it('does not apply opaque background classes', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).not.toContain('bg-muted/50')
            expect(trigger.className).not.toContain('bg-muted/30')
            expect(trigger.className).not.toContain('bg-muted')
        })

        it('inherits transparent background from base SelectTrigger', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).not.toContain('bg-muted/50')
            expect(trigger.className).not.toContain('border-0')
        })

        it('applies compact height styling', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).toContain('h-7')
        })

        it('applies small text sizing', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).toContain('text-xs')
        })
    })

    describe('dynamic width sizing', () => {
        it('does not apply fixed width classes', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).not.toContain('w-32')
            expect(trigger.className).not.toContain('w-40')
            expect(trigger.className).not.toContain('w-48')
        })

        it('inherits dynamic width from base SelectTrigger', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).not.toMatch(/\bw-\d+\b/)
        })
    })

    describe('border styling', () => {
        it('does not suppress borders', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).not.toContain('border-0')
        })
    })

    describe('accessibility attributes', () => {
        it('maintains role attribute', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            expect(trigger).toHaveAttribute('role', 'combobox')
        })

        it('maintains aria-expanded attribute', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            expect(trigger).toHaveAttribute('aria-expanded')
        })

        it('is keyboard accessible', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            trigger.focus()
            expect(document.activeElement).toBe(trigger)
        })
    })

    describe('profile selection interaction', () => {
        it('calls onProfileSelect when profile is changed', async () => {
            const onProfileSelect = vi.fn()
            
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
                onProfileSelect,
                profileId: undefined,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            fireEvent.click(trigger)

            await waitFor(() => {
                const listbox = screen.queryByRole('listbox')
                expect(listbox).toBeInTheDocument()
            })

            const listbox = screen.getByRole('listbox')
            const option = within(listbox).getByText('Default Profile')
            fireEvent.click(option)

            expect(onProfileSelect).toHaveBeenCalledWith('prof-1')
        })

        it('displays selected profile value', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
                profileId: 'prof-1',
            })

            expect(screen.getByText('Default Profile')).toBeInTheDocument()
        })

        it('displays default when no profile selected', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
                profileId: undefined,
            })

            expect(screen.getByText('Default')).toBeInTheDocument()
        })
    })

    describe('profile selector with long names', () => {
        it('renders long profile names without truncation in trigger', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
                profileId: 'prof-2',
            })

            const longName = screen.getByText('High-Performance Optimized Profile')
            expect(longName).toBeInTheDocument()
        })

        it('renders all profile options in dropdown', async () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            fireEvent.click(trigger)

            await waitFor(() => {
                const listbox = screen.queryByRole('listbox')
                expect(listbox).toBeInTheDocument()
            })

            const listbox = screen.getByRole('listbox')
            
            expect(within(listbox).getByText('Default Profile')).toBeInTheDocument()
            expect(within(listbox).getByText('High-Performance Optimized Profile')).toBeInTheDocument()
            expect(within(listbox).getByText('Debug Mode with Extended Logging')).toBeInTheDocument()
        })
    })

    describe('consistency with other selectors', () => {
        it('matches base SelectTrigger pattern for transparent styling', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.getByRole('combobox', {hidden: true})
            
            expect(trigger.className).not.toContain('bg-muted')
            expect(trigger.className).not.toContain('w-32')
            expect(trigger.className).not.toContain('border-0')
        })
    })

    describe('locked state behavior', () => {
        it('does not render profile selector when locked', () => {
            renderAttemptsSection({
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
                locked: true,
            })

            const trigger = screen.queryByRole('combobox', {hidden: true})
            expect(trigger).toBeNull()
        })
    })

    describe('without session behavior', () => {
        it('does not render profile selector when attempt has no sessionId', () => {
            renderAttemptsSection({
                attempt: {...baseAttempt, sessionId: null},
                attemptAgent: 'codex' as AgentKey,
                followupProfiles: mockProfiles,
            })

            const trigger = screen.queryByRole('combobox', {hidden: true})
            expect(trigger).toBeNull()
        })
    })
})
