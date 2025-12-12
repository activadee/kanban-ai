import {describe, expect, it} from 'vitest'
import {isAutomationFailureAllowed} from '../src/attempts/automation'
import type {AutomationStage} from 'shared'

const stages: AutomationStage[] = ['copy_files', 'setup', 'dev', 'cleanup']

describe('isAutomationFailureAllowed', () => {
    it('allows all stages when global setting is enabled', () => {
        const config = {
            allowScriptsToFail: true,
            allowCopyFilesToFail: false,
            allowSetupScriptToFail: false,
            allowDevScriptToFail: false,
            allowCleanupScriptToFail: false,
        }
        for (const stage of stages) {
            expect(isAutomationFailureAllowed(stage, config)).toBe(true)
        }
    })

    it('allows a single stage when per-script override is enabled', () => {
        const config = {
            allowScriptsToFail: false,
            allowCopyFilesToFail: false,
            allowSetupScriptToFail: true,
            allowDevScriptToFail: false,
            allowCleanupScriptToFail: false,
        }
        expect(isAutomationFailureAllowed('setup', config)).toBe(true)
        expect(isAutomationFailureAllowed('copy_files', config)).toBe(false)
        expect(isAutomationFailureAllowed('dev', config)).toBe(false)
        expect(isAutomationFailureAllowed('cleanup', config)).toBe(false)
    })

    it('blocks failures when neither global nor per-script overrides are enabled', () => {
        const config = {
            allowScriptsToFail: false,
            allowCopyFilesToFail: false,
            allowSetupScriptToFail: false,
            allowDevScriptToFail: false,
            allowCleanupScriptToFail: false,
        }
        for (const stage of stages) {
            expect(isAutomationFailureAllowed(stage, config)).toBe(false)
        }
    })
})

