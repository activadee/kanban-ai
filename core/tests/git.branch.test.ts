import {describe, expect, it} from 'vitest'
import {renderBranchName} from '../src/git/branch'

describe('git/branch', () => {
    it('renders branch using template tokens', () => {
        const name = renderBranchName('{prefix}/{ticketKey}-{slug}', {
            prefix: 'prod ops',
            ticketKey: 'CARD-12',
            slugSource: 'Implement fancy feature',
        })

        expect(name).toBe('PRODOP/CARD-12-implement-fancy-feature')
    })

    it('falls back to slug when template resolves empty', () => {
        const name = renderBranchName('', {
            slugSource: 'Quick Fix',
        })

        expect(name).toMatch(/^kanbanai\/quick-fix/)
    })

    it('handles missing slug source by using ticket or prefix', () => {
        const name = renderBranchName('{prefix}/{slug}', {
            prefix: 'abc!!',
            ticketKey: null,
            slugSource: null,
        })

        expect(name).toBe('ABC/abc')
    })

    it('supports ticket type placeholder for conventional branches', () => {
        const name = renderBranchName('{type}/{ticketKey}-{slug}', {
            type: 'feat',
            ticketKey: 'PRJ-9',
            slugSource: 'Add auth flow',
        })

        expect(name).toBe('feat/PRJ-9-add-auth-flow')
    })
})
