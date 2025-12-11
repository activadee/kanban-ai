import {describe, expect, it} from 'vitest'

import {DroidProfileSchema} from '../src/agents/droid/profiles/schema'

describe('DroidProfileSchema reasoningEffort', () => {
    it('accepts xhigh as a valid reasoning effort', () => {
        const parsed = DroidProfileSchema.safeParse({
            appendPrompt: null,
            inlineProfile: null,
            reasoningEffort: 'xhigh',
        })

        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.reasoningEffort).toBe('xhigh')
        }
    })

    it('rejects unknown reasoning effort values', () => {
        const parsed = DroidProfileSchema.safeParse({
            reasoningEffort: 'ultra',
        } as unknown)

        expect(parsed.success).toBe(false)
    })
})

