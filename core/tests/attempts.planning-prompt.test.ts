import {describe, expect, it} from 'vitest'

import {buildPlanningAttemptDescription} from '../src/attempts/planning-prompt'

describe('buildPlanningAttemptDescription', () => {
    it('wraps the original description with planning instructions', () => {
        const out = buildPlanningAttemptDescription('Do X and Y.')
        expect(out).toContain('## Planning Mode')
        expect(out).toContain('## Plan')
        expect(out).toContain('## Ticket Description')
        expect(out).toContain('Do X and Y.')
    })

    it('includes the agent profile prompt when provided', () => {
        const out = buildPlanningAttemptDescription('Do X.', 'Follow the house rules.')
        expect(out).toContain('### Agent Profile Prompt')
        expect(out).toContain('Follow the house rules.')
    })

    it('handles missing descriptions', () => {
        const out = buildPlanningAttemptDescription(null)
        expect(out).toContain('(No description provided.)')
    })
})
