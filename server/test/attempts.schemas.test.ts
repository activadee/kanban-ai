import {describe, it, expect} from 'vitest'
import {startAttemptSchema} from '../src/attempts/attempts.schemas'

describe('startAttemptSchema', () => {
    it('accepts CODEX agent', () => {
        const result = startAttemptSchema.safeParse({agent: 'CODEX'})
        expect(result.success).toBe(true)
    })

    it('accepts OPENCODE agent', () => {
        const result = startAttemptSchema.safeParse({agent: 'OPENCODE'})
        expect(result.success).toBe(true)
    })

    it('accepts DROID agent', () => {
        const result = startAttemptSchema.safeParse({agent: 'DROID'})
        expect(result.success).toBe(true)
    })

    it('accepts DROID with optional fields', () => {
        const result = startAttemptSchema.safeParse({
            agent: 'DROID',
            profileId: 'profile-1',
            baseBranch: 'main',
            branchName: 'feature/test',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual({
                agent: 'DROID',
                profileId: 'profile-1',
                baseBranch: 'main',
                branchName: 'feature/test',
            })
        }
    })

    it('rejects unsupported agent types', () => {
        const result = startAttemptSchema.safeParse({agent: 'ECHO'})
        expect(result.success).toBe(false)
    })

    it('rejects invalid agent type', () => {
        const result = startAttemptSchema.safeParse({agent: 'INVALID'})
        expect(result.success).toBe(false)
    })

    it('requires agent field', () => {
        const result = startAttemptSchema.safeParse({})
        expect(result.success).toBe(false)
    })
})
