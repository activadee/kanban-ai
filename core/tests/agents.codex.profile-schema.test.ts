import {describe, expect, it} from 'vitest'

import {CodexProfileSchema} from '../src/agents/codex/profiles/schema'

describe('CodexProfileSchema modelReasoningEffort', () => {
    it('accepts xhigh as a valid reasoning effort', () => {
        const parsed = CodexProfileSchema.safeParse({
            appendPrompt: null,
            inlineProfile: null,
            modelReasoningEffort: 'xhigh',
        })

        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.modelReasoningEffort).toBe('xhigh')
        }
    })

    it('rejects unknown reasoning effort values', () => {
        const parsed = CodexProfileSchema.safeParse({
            modelReasoningEffort: 'ultra',
        } as unknown)

        expect(parsed.success).toBe(false)
    })
})
