import {describe, it, expect, vi} from 'vitest'
import {render, screen, fireEvent} from '@testing-library/react'
import {FileText, Folder, Settings} from 'lucide-react'

import {MasterDetailLayout, type MasterDetailItem} from '@/components/layout/MasterDetailLayout'

const mockItems: MasterDetailItem[] = [
    {id: 'item-1', label: 'Documents', subtitle: '12 files', icon: FileText},
    {id: 'item-2', label: 'Projects', subtitle: '3 active', icon: Folder},
    {id: 'item-3', label: 'Settings', icon: Settings},
]

describe('MasterDetailLayout', () => {
    it('renders sidebar with title and items', () => {
        render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={vi.fn()}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        expect(screen.getByText('Navigation')).toBeTruthy()
        expect(screen.getByText('Documents')).toBeTruthy()
        expect(screen.getByText('Projects')).toBeTruthy()
        expect(screen.getByText('Settings')).toBeTruthy()
    })

    it('renders item subtitles when provided', () => {
        render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={vi.fn()}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        expect(screen.getByText('12 files')).toBeTruthy()
        expect(screen.getByText('3 active')).toBeTruthy()
    })

    it('calls onSelect when an item is clicked', () => {
        const onSelect = vi.fn()
        render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={onSelect}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        const documentsButton = screen.getByRole('button', {name: /Documents/i})
        fireEvent.click(documentsButton)

        expect(onSelect).toHaveBeenCalledWith('item-1')
    })

    it('highlights the active item', () => {
        const {container} = render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId="item-2"
                onSelect={vi.fn()}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        const projectsButton = screen.getByRole('button', {name: /Projects/i})
        expect(projectsButton.className).toContain('bg-sidebar-accent')
    })

    it('renders main content area', () => {
        render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={vi.fn()}
            >
                <div data-testid="main-content">Main content here</div>
            </MasterDetailLayout>
        )

        expect(screen.getByTestId('main-content')).toBeTruthy()
        expect(screen.getByText('Main content here')).toBeTruthy()
    })

    it('renders loading state', () => {
        render(
            <MasterDetailLayout
                title="Navigation"
                items={[]}
                activeId={null}
                onSelect={vi.fn()}
                loading={true}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        expect(screen.getByText('Loading...')).toBeTruthy()
    })

    it('renders empty state when no items and emptyState provided', () => {
        render(
            <MasterDetailLayout
                title="Navigation"
                items={[]}
                activeId={null}
                onSelect={vi.fn()}
                emptyState={<div data-testid="empty-state">No items available</div>}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        expect(screen.getByTestId('empty-state')).toBeTruthy()
        expect(screen.getByText('No items available')).toBeTruthy()
    })
})

describe('MasterDetailLayout – renderItem prop', () => {
    it('uses custom renderItem function when provided', () => {
        const customRenderItem = vi.fn((item: MasterDetailItem, isActive: boolean) => (
            <div data-testid={`custom-item-${item.id}`} className="custom-item">
                Custom: {item.label} {isActive ? '(active)' : ''}
            </div>
        ))

        render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId="item-1"
                onSelect={vi.fn()}
                renderItem={customRenderItem}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        expect(screen.getByTestId('custom-item-item-1')).toBeTruthy()
        expect(screen.getByText('Custom: Documents (active)')).toBeTruthy()
        expect(screen.getByText('Custom: Projects')).toBeTruthy()
        expect(customRenderItem).toHaveBeenCalledTimes(3)
    })

    it('passes defaultRender function to renderItem', () => {
        const customRenderItem = vi.fn(
            (item: MasterDetailItem, isActive: boolean, defaultRender: () => React.ReactNode) => (
                <div data-testid={`wrapper-${item.id}`} className="wrapper">
                    {defaultRender()}
                    <span className="badge">Extra</span>
                </div>
            )
        )

        render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={vi.fn()}
                renderItem={customRenderItem}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        expect(screen.getByTestId('wrapper-item-1')).toBeTruthy()
        expect(screen.getByText('Documents')).toBeTruthy()
        expect(screen.getAllByText('Extra').length).toBe(3)
    })
})

describe('MasterDetailLayout – sidebarFooter prop', () => {
    it('renders sidebarFooter when provided', () => {
        render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={vi.fn()}
                sidebarFooter={
                    <div data-testid="sidebar-footer">
                        <button>Quick Action</button>
                    </div>
                }
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        expect(screen.getByTestId('sidebar-footer')).toBeTruthy()
        expect(screen.getByText('Quick Action')).toBeTruthy()
    })

    it('does not render footer section when sidebarFooter is not provided', () => {
        const {container} = render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={vi.fn()}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        const footerBorder = container.querySelector('aside > div.border-t')
        expect(footerBorder).toBeNull()
    })
})

describe('MasterDetailLayout – sidebarClassName prop', () => {
    it('applies additional className to sidebar', () => {
        const {container} = render(
            <MasterDetailLayout
                title="Navigation"
                items={mockItems}
                activeId={null}
                onSelect={vi.fn()}
                sidebarClassName="custom-sidebar-class w-80"
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        const sidebar = container.querySelector('aside')
        expect(sidebar?.className).toContain('custom-sidebar-class')
        expect(sidebar?.className).toContain('w-80')
    })
})

describe('MasterDetailLayout – disabled items', () => {
    it('disables item interaction when disabled is true', () => {
        const itemsWithDisabled: MasterDetailItem[] = [
            {id: 'item-1', label: 'Active', icon: FileText},
            {id: 'item-2', label: 'Disabled', icon: Folder, disabled: true},
        ]

        const onSelect = vi.fn()
        render(
            <MasterDetailLayout
                title="Navigation"
                items={itemsWithDisabled}
                activeId={null}
                onSelect={onSelect}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        const disabledButton = screen.getByRole('button', {name: /Disabled/i})
        expect(disabledButton).toHaveProperty('disabled', true)
        expect(disabledButton.className).toContain('opacity-50')

        fireEvent.click(disabledButton)
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('allows clicking non-disabled items', () => {
        const itemsWithDisabled: MasterDetailItem[] = [
            {id: 'item-1', label: 'Active', icon: FileText},
            {id: 'item-2', label: 'Disabled', icon: Folder, disabled: true},
        ]

        const onSelect = vi.fn()
        render(
            <MasterDetailLayout
                title="Navigation"
                items={itemsWithDisabled}
                activeId={null}
                onSelect={onSelect}
            >
                <div>Main content</div>
            </MasterDetailLayout>
        )

        const activeButton = screen.getByRole('button', {name: /Active/i})
        fireEvent.click(activeButton)

        expect(onSelect).toHaveBeenCalledWith('item-1')
    })
})
