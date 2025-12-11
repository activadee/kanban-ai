import {describe, expect, it} from 'vitest'

import {buildDroidCommand} from '../src/agents/droid/profiles/build'
import type {DroidProfile} from '../src/agents/droid/profiles/schema'

describe('buildDroidCommand reasoningEffort', () => {
    it('forwards reasoningEffort xhigh via -r flag', () => {
        const profile: DroidProfile = {
            appendPrompt: null,
            inlineProfile: null,
            autonomy: 'read-only',
            model: 'test-model',
            reasoningEffort: 'xhigh',
            baseCommandOverride: null,
            additionalParams: [],
            debug: false,
        }

        const {params} = buildDroidCommand(profile, 'prompt', 'json')

        expect(params).toContain('-r')
        const flagIndex = params.indexOf('-r')
        expect(flagIndex).toBeGreaterThanOrEqual(0)
        expect(params[flagIndex + 1]).toBe('xhigh')
    })
})

