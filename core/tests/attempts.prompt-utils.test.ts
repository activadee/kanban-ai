import {describe, expect, it} from 'vitest'

import {
    buildImplementationFollowupPrompt,
    extractAgentProfileAppendPrompt,
    stripProfilePromptsForPlanning,
} from '../src/attempts/prompt-utils'

describe('attempt prompt utils', () => {
    describe('extractAgentProfileAppendPrompt', () => {
        it('returns trimmed appendPrompt string', () => {
            expect(extractAgentProfileAppendPrompt({appendPrompt: '  hello  '})).toBe('hello')
        })

        it('returns empty string when appendPrompt is missing', () => {
            expect(extractAgentProfileAppendPrompt({})).toBe('')
        })

        it('returns empty string when profile is not an object', () => {
            expect(extractAgentProfileAppendPrompt(null)).toBe('')
            expect(extractAgentProfileAppendPrompt('nope')).toBe('')
        })
    })

    describe('buildImplementationFollowupPrompt', () => {
        it('appends agent profile prompt after follow-up prompt', () => {
            const out = buildImplementationFollowupPrompt('Continue', {appendPrompt: 'Rules'})
            expect(out).toBe('Continue\n\nRules')
        })

        it('returns follow-up prompt when no profile prompt exists', () => {
            const out = buildImplementationFollowupPrompt('  Continue  ', {appendPrompt: null})
            expect(out).toBe('Continue')
        })

        it('returns profile prompt when follow-up prompt is empty', () => {
            const out = buildImplementationFollowupPrompt('   ', {appendPrompt: 'Rules'})
            expect(out).toBe('Rules')
        })
    })

    describe('stripProfilePromptsForPlanning', () => {
        it('clears appendPrompt and inlineProfile', () => {
            const out = stripProfilePromptsForPlanning({
                appendPrompt: 'keep me out',
                inlineProfile: 'also out',
                other: 123,
            })
            expect(out).toEqual({
                appendPrompt: null,
                inlineProfile: null,
                other: 123,
            })
        })

        it('returns non-objects unchanged', () => {
            expect(stripProfilePromptsForPlanning(null)).toBe(null)
            expect(stripProfilePromptsForPlanning('x')).toBe('x')
        })
    })
})

