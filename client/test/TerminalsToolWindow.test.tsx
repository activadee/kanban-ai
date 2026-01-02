import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen, fireEvent, within} from '@testing-library/react'
import type {EligibleTerminalCard} from 'shared'
import * as reactQuery from '@tanstack/react-query'

import {TerminalsToolWindow} from '@/components/Terminal/TerminalsToolWindow'

vi.mock('@/components/Terminal/Terminal', () => ({
    Terminal: ({onStatusChange}: {onStatusChange?: (status: string) => void}) => {
        React.useEffect(() => {
            onStatusChange?.('connected')
        }, [onStatusChange])
        return <div data-testid="terminal-mock">Terminal</div>
    },
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query')
    return {
        ...actual,
        useQuery: vi.fn(),
    }
})

vi.mock('@/api/terminals', () => ({
    getEligibleCards: vi.fn(),
    closeTerminal: vi.fn(),
}))

const mockEligibleCards: EligibleTerminalCard[] = [
    {
        cardId: 'card-1',
        attemptId: 'attempt-1',
        worktreePath: '/path/to/feature-branch',
        hasActiveTerminal: false,
    },
    {
        cardId: 'card-2',
        attemptId: 'attempt-2',
        worktreePath: '/path/to/bugfix-branch',
        hasActiveTerminal: true,
    },
    {
        cardId: 'card-3',
        attemptId: 'attempt-3',
        worktreePath: '/path/to/refactor-branch',
        hasActiveTerminal: false,
    },
]

describe('TerminalsToolWindow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(reactQuery.useQuery).mockReturnValue({
            data: {eligible: mockEligibleCards},
            refetch: vi.fn(),
            isLoading: false,
        } as any)
    })

    it('renders the workstations sidebar with eligible cards', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        expect(screen.getByText('Workstations')).toBeTruthy()
        expect(screen.getAllByText('feature-branch').length).toBeGreaterThan(0)
        expect(screen.getAllByText('bugfix-branch').length).toBeGreaterThan(0)
        expect(screen.getAllByText('refactor-branch').length).toBeGreaterThan(0)
    })

    it('shows connected status for cards with active terminals', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        const connectedIndicators = screen.getAllByText('Connected')
        expect(connectedIndicators.length).toBeGreaterThan(0)
    })

    it('shows Ready status for cards without active terminals', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        const readyIndicators = screen.getAllByText('Ready')
        expect(readyIndicators.length).toBe(2)
    })

    it('opens a terminal when clicking on a workstation item', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        const sidebar = screen.getByRole('navigation')
        const featureBranchButton = within(sidebar).getByRole('button', {name: /feature-branch/i})
        fireEvent.click(featureBranchButton)

        expect(screen.getByTestId('terminal-mock')).toBeTruthy()
    })

    it('shows "Open" badge for opened terminals in sidebar', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        const sidebar = screen.getByRole('navigation')
        const featureBranchButton = within(sidebar).getByRole('button', {name: /feature-branch/i})
        fireEvent.click(featureBranchButton)

        expect(screen.getByText('Open')).toBeTruthy()
    })

    it('renders Quick Launch section with available cards', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        expect(screen.getByText('Quick Launch')).toBeTruthy()
    })

    it('shows empty state when no worktrees are available', () => {
        vi.mocked(reactQuery.useQuery).mockReturnValue({
            data: {eligible: []},
            refetch: vi.fn(),
            isLoading: false,
        } as any)

        render(<TerminalsToolWindow projectId="project-1" />)

        expect(screen.getByText('No worktrees active')).toBeTruthy()
    })

    it('shows "Select a Workstation" prompt when no terminals are open', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        expect(screen.getByText('Select a Workstation')).toBeTruthy()
    })

    it('can open multiple terminals', () => {
        render(<TerminalsToolWindow projectId="project-1" />)

        const sidebar = screen.getByRole('navigation')

        const featureBranchButton = within(sidebar).getByRole('button', {name: /feature-branch/i})
        fireEvent.click(featureBranchButton)

        const bugfixBranchButton = within(sidebar).getByRole('button', {name: /bugfix-branch/i})
        fireEvent.click(bugfixBranchButton)

        const terminals = screen.getAllByTestId('terminal-mock')
        expect(terminals.length).toBe(2)
    })

    it('uses grid layout for multiple terminals', () => {
        const {container} = render(<TerminalsToolWindow projectId="project-1" />)

        const sidebar = screen.getByRole('navigation')

        const featureBranchButton = within(sidebar).getByRole('button', {name: /feature-branch/i})
        fireEvent.click(featureBranchButton)

        const bugfixBranchButton = within(sidebar).getByRole('button', {name: /bugfix-branch/i})
        fireEvent.click(bugfixBranchButton)

        const gridContainer = container.querySelector('.grid')
        expect(gridContainer).toBeTruthy()
        expect(gridContainer?.className).toContain('grid-cols-1')
        expect(gridContainer?.className).toContain('lg:grid-cols-2')
        expect(gridContainer?.className).toContain('xl:grid-cols-3')
    })
})
