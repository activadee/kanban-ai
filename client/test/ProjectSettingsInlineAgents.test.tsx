import {describe, it, expect} from 'vitest'
import type {ProjectSettings} from 'shared'
import {
    mapSettingsToForm,
    buildProjectSettingsUpdate,
    type ProjectSettingsFormState,
} from '@/components/projects/ProjectSettingsPanel/useProjectSettingsForm'

describe('ProjectSettingsForm inline agents mapping', () => {
    it('maps inlineAgentProfileMapping from settings into form state', () => {
        const settings: ProjectSettings = {
            projectId: 'proj-1',
            boardId: 'board-1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            allowScriptsToFail: false,
            allowCopyFilesToFail: false,
            allowSetupScriptToFail: false,
            allowDevScriptToFail: false,
            allowCleanupScriptToFail: false,
            defaultAgent: 'CODEX',
            defaultProfileId: 'ap-default',
            inlineAgent: 'CODEX',
            inlineProfileId: 'ap-inline',
            inlineAgentProfileMapping: {
                ticketEnhance: 'ap-inline-ticket',
                prSummary: null,
            },
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            githubIssueSyncEnabled: false,
            githubIssueSyncState: 'open',
            githubIssueSyncIntervalMinutes: 15,
            lastGithubIssueSyncAt: null,
            lastGithubIssueSyncStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }

        const form = mapSettingsToForm(settings)
        expect(form.inlineAgentProfileMapping).toEqual({
            ticketEnhance: 'ap-inline-ticket',
            prSummary: null,
        })
    })

    it('emits inlineAgentProfileMapping patch when mapping changes', () => {
        const initial: ProjectSettings = {
            projectId: 'proj-1',
            boardId: 'board-1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            allowScriptsToFail: false,
            allowCopyFilesToFail: false,
            allowSetupScriptToFail: false,
            allowDevScriptToFail: false,
            allowCleanupScriptToFail: false,
            defaultAgent: 'CODEX',
            defaultProfileId: 'ap-default',
            inlineAgent: 'CODEX',
            inlineProfileId: 'ap-inline',
            inlineAgentProfileMapping: {},
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            githubIssueSyncEnabled: false,
            githubIssueSyncState: 'open',
            githubIssueSyncIntervalMinutes: 15,
            lastGithubIssueSyncAt: null,
            lastGithubIssueSyncStatus: 'idle',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }

        const form: ProjectSettingsFormState = {
            ...mapSettingsToForm(initial),
            inlineAgentProfileMapping: {
                ticketEnhance: 'ap-inline-ticket',
            },
        }

        const patch = buildProjectSettingsUpdate(initial, form)
        expect(patch.inlineAgentProfileMapping).toEqual({
            ticketEnhance: 'ap-inline-ticket',
        })
    })
})
