import React from 'react'
import {describe, it, expect} from 'vitest'
import {render, screen} from '@testing-library/react'

import {PageHeader} from '@/components/layout/PageHeader'

describe('PageHeader', () => {
    it('renders a level-1 heading with the title', () => {
        render(<PageHeader title="Hello"/>)

        expect(
            screen.getByRole('heading', {level: 1, name: 'Hello'}),
        ).toBeTruthy()
    })

    it('renders optional description, kicker, actions, and footer content', () => {
        render(
            <PageHeader
                kicker="Section"
                title="Title"
                description="Description"
                actions={<button type="button">Action</button>}
            >
                <span>Footer content</span>
            </PageHeader>,
        )

        expect(screen.getByText('Section')).toBeTruthy()
        expect(screen.getByText('Description')).toBeTruthy()
        expect(screen.getByRole('button', {name: 'Action'})).toBeTruthy()
        expect(screen.getByText('Footer content')).toBeTruthy()
    })

    it('includes responsive padding classes and supports containerClassName', () => {
        render(<PageHeader title="Responsive" containerClassName="max-w-5xl"/>)

        const header = screen.getByTestId('page-header')
        expect(header.getAttribute('data-component')).toBe('PageHeader')
        expect(header.className).toContain('border-b')

        const container = header.querySelector('div')
        expect(container).toBeTruthy()
        expect(container?.className).toContain('sm:px-6')
        expect(container?.className).toContain('lg:px-8')
        expect(container?.className).toContain('max-w-5xl')
    })

    it('matches the snapshot (visual regression)', () => {
        const {container} = render(
            <PageHeader
                kicker="Kicker"
                title="Snapshot Title"
                description="Snapshot description"
                actions={<button type="button">Action</button>}
                containerClassName="max-w-5xl"
            >
                <span>Footer</span>
            </PageHeader>,
        )

        expect(container.firstChild).toMatchSnapshot()
    })
})

