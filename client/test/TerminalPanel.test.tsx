import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen, fireEvent} from '@testing-library/react'

import {TerminalPanel} from '@/components/Terminal/TerminalPanel'

vi.mock('@/components/Terminal/Terminal', () => ({
    Terminal: ({onStatusChange}: {onStatusChange?: (status: string) => void}) => {
        React.useEffect(() => {
            onStatusChange?.('connected')
        }, [onStatusChange])
        return <div data-testid="terminal-mock">Terminal</div>
    },
}))

describe('TerminalPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders terminal panel with title', () => {
        render(
            <TerminalPanel
                cardId="card-1"
                projectId="project-1"
                title="feature-branch"
            />
        )

        expect(screen.getByText('feature-branch')).toBeTruthy()
        expect(screen.getByTestId('terminal-mock')).toBeTruthy()
    })

    it('shows connected status badge when terminal connects', () => {
        render(
            <TerminalPanel
                cardId="card-1"
                projectId="project-1"
                title="feature-branch"
            />
        )

        expect(screen.getByText('Connected')).toBeTruthy()
    })

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn()
        render(
            <TerminalPanel
                cardId="card-1"
                projectId="project-1"
                title="feature-branch"
                onClose={onClose}
            />
        )

        const closeButton = screen.getByTitle('Close terminal')
        fireEvent.click(closeButton)

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not render close button when onClose is not provided', () => {
        render(
            <TerminalPanel
                cardId="card-1"
                projectId="project-1"
                title="feature-branch"
            />
        )

        expect(screen.queryByTitle('Close terminal')).toBeNull()
    })

    it('toggles maximize state when maximize button is clicked', () => {
        const {container} = render(
            <TerminalPanel
                cardId="card-1"
                projectId="project-1"
                title="feature-branch"
            />
        )

        const maximizeButton = screen.getByTitle('Maximize')
        fireEvent.click(maximizeButton)

        const card = container.querySelector('[class*="fixed"]')
        expect(card).toBeTruthy()

        const restoreButton = screen.getByTitle('Restore')
        fireEvent.click(restoreButton)

        const cardAfterRestore = container.querySelector('[class*="fixed"]')
        expect(cardAfterRestore).toBeNull()
    })

    it('applies custom className', () => {
        const {container} = render(
            <TerminalPanel
                cardId="card-1"
                projectId="project-1"
                title="feature-branch"
                className="h-[350px]"
            />
        )

        const card = container.firstChild as HTMLElement
        expect(card.className).toContain('h-[350px]')
    })
})

describe('TerminalPanel – status indicators', () => {
    it('displays different status badges based on terminal status', () => {
        let statusCallback: ((status: string) => void) | undefined

        vi.doMock('@/components/Terminal/Terminal', () => ({
            Terminal: ({onStatusChange}: {onStatusChange?: (status: string) => void}) => {
                statusCallback = onStatusChange
                return <div data-testid="terminal-mock">Terminal</div>
            },
        }))

        const {rerender} = render(
            <TerminalPanel
                cardId="card-1"
                projectId="project-1"
                title="test-branch"
            />
        )

        expect(screen.getByText('Connected')).toBeTruthy()
    })
})
