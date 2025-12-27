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

    it('handles missing descriptions', () => {
        const out = buildPlanningAttemptDescription(null)
        expect(out).toContain('(No description provided.)')
    })
})
