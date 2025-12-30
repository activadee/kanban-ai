import {describe, expect, it} from 'vitest'

import {DroidProfileSchema} from '../src/agents/droid/profiles/schema'

describe('DroidProfileSchema', () => {
    it('accepts none as a valid reasoning effort', () => {
        const parsed = DroidProfileSchema.safeParse({
            appendPrompt: null,
            inlineProfile: null,
            reasoningEffort: 'none',
        })

        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.reasoningEffort).toBe('none')
        }
    })

    it('accepts all valid autonomyLevel values', () => {
        const values = ['default', 'low', 'medium', 'high'] as const
        for (const value of values) {
            const parsed = DroidProfileSchema.safeParse({autonomyLevel: value})
            expect(parsed.success).toBe(true)
        }
    })

    it('accepts all valid reasoningEffort values', () => {
        const values = ['off', 'none', 'low', 'medium', 'high'] as const
        for (const value of values) {
            const parsed = DroidProfileSchema.safeParse({reasoningEffort: value})
            expect(parsed.success).toBe(true)
        }
    })

    it('rejects unknown reasoning effort values', () => {
        const parsed = DroidProfileSchema.safeParse({
            reasoningEffort: 'ultra',
        } as unknown)

        expect(parsed.success).toBe(false)
    })

    it('rejects unknown autonomyLevel values', () => {
        const parsed = DroidProfileSchema.safeParse({
            autonomyLevel: 'read-only',
        } as unknown)

        expect(parsed.success).toBe(false)
    })

    it('accepts new SDK options', () => {
        const parsed = DroidProfileSchema.safeParse({
            useSpec: true,
            specModel: 'gpt-4',
            specReasoningEffort: 'high',
            enabledTools: ['bash', 'read'],
            disabledTools: ['write'],
            skipPermissionsUnsafe: false,
        })

        expect(parsed.success).toBe(true)
        if (parsed.success) {
            expect(parsed.data.useSpec).toBe(true)
            expect(parsed.data.enabledTools).toEqual(['bash', 'read'])
        }
    })
})
