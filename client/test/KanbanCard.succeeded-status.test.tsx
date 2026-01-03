import {describe, it, expect} from 'vitest'
import {render, screen} from '@testing-library/react'

import {KanbanCard} from '@/components/kanban/Card'
import type {Card} from 'shared'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'

const baseCard: Card = {
    id: 'card-1',
    title: 'Test ticket',
    description: 'Test description',
    isEnhanced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

const wrapper = ({children}: {children: React.ReactNode}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('KanbanCard – succeeded status marker', () => {
    it('displays success marker when attempt succeeded', () => {
        render(<KanbanCard card={baseCard} attemptStatus="succeeded" />, {wrapper})

        const badge = screen.getByText('Succeeded')
        expect(badge).toBeTruthy()
    })

    it('applies succeeded card class when attempt succeeded', () => {
        const {container} = render(<KanbanCard card={baseCard} attemptStatus="succeeded" />, {wrapper})

        const cardElement = container.querySelector('.kanban-card--succeeded')
        expect(cardElement).toBeTruthy()
    })

    it('hides marker when no attempts exist', () => {
        render(<KanbanCard card={baseCard} />, {wrapper})

        const badge = screen.queryByText('Succeeded')
        expect(badge).toBeNull()
    })

    it('hides marker when latest attempt failed', () => {
        render(<KanbanCard card={baseCard} attemptStatus="failed" />, {wrapper})

        const succeededBadge = screen.queryByText('Succeeded')
        expect(succeededBadge).toBeNull()

        const failedBadge = screen.getByText('Failed')
        expect(failedBadge).toBeTruthy()
    })

    it('hides marker when card is in Done column', () => {
        render(<KanbanCard card={baseCard} attemptStatus="succeeded" done={true} />, {wrapper})

        const badge = screen.queryByText('Succeeded')
        expect(badge).toBeNull()
    })

    it('does not apply succeeded class when done', () => {
        const {container} = render(<KanbanCard card={baseCard} attemptStatus="succeeded" done={true} />, {wrapper})

        const succeededCard = container.querySelector('.kanban-card--succeeded')
        expect(succeededCard).toBeNull()

        const doneCard = container.querySelector('.kanban-card--done')
        expect(doneCard).toBeTruthy()
    })

    it('hides marker when attempt is running', () => {
        render(<KanbanCard card={baseCard} attemptStatus="running" />, {wrapper})

        const badge = screen.queryByText('Succeeded')
        expect(badge).toBeNull()
    })

    it('hides marker when attempt is stopped', () => {
        render(<KanbanCard card={baseCard} attemptStatus="stopped" />, {wrapper})

        const badge = screen.queryByText('Succeeded')
        expect(badge).toBeNull()
    })

    it('has accessible aria-label on success indicator', () => {
        const {container} = render(<KanbanCard card={baseCard} attemptStatus="succeeded" />, {wrapper})

        const indicator = container.querySelector('[aria-label="Attempt succeeded"]')
        expect(indicator).toBeTruthy()
    })

    it('success indicator uses correct CSS class', () => {
        const {container} = render(<KanbanCard card={baseCard} attemptStatus="succeeded" />, {wrapper})

        const indicator = container.querySelector('.kanban-indicator--succeeded')
        expect(indicator).toBeTruthy()
    })

    it('succeeded class takes precedence over blocked class', () => {
        const {container} = render(
            <KanbanCard card={baseCard} attemptStatus="succeeded" blocked={true} blockers={['Dependency 1']} />,
            {wrapper},
        )

        const succeededCard = container.querySelector('.kanban-card--succeeded')
        const blockedCard = container.querySelector('.kanban-card--blocked')

        expect(succeededCard).toBeTruthy()
        expect(blockedCard).toBeNull()
    })

    it('failed status takes precedence over succeeded status styling', () => {
        const {container} = render(<KanbanCard card={baseCard} attemptStatus="failed" />, {wrapper})

        const failedCard = container.querySelector('.kanban-card--failed')
        const succeededCard = container.querySelector('.kanban-card--succeeded')

        expect(failedCard).toBeTruthy()
        expect(succeededCard).toBeNull()
    })
})
