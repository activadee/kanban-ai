import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectAntigravityCommandCandidates } from '../src/editor/adapters/antigravity'

describe('antigravity adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    describe('collectAntigravityCommandCandidates', () => {
        it('returns basic command candidates', () => {
            const candidates = collectAntigravityCommandCandidates()
            expect(candidates).toBeInstanceOf(Array)
            expect(candidates.length).toBeGreaterThan(0)
        })

        it('includes antigravity command', () => {
            const candidates = collectAntigravityCommandCandidates()
            expect(candidates).toContain('antigravity')
        })

        it('includes antigravity.exe for Windows', () => {
            const candidates = collectAntigravityCommandCandidates()
            expect(candidates).toContain('antigravity.exe')
        })
    })
})
