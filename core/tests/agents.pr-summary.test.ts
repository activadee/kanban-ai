import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../src/projects/service', () => ({
    projectsService: {
        get: vi.fn(),
    },
}))

vi.mock('../src/projects/settings/service', () => ({
    ensureProjectSettings: vi.fn(),
}))

vi.mock('../src/agents/registry', () => ({
    getAgent: vi.fn(),
}))

vi.mock('../src/agents/inline', () => ({
    runInlineTask: vi.fn(),
}))

vi.mock('../src/agents/profile-resolution', () => ({
    resolveAgentProfile: vi.fn(),
}))

vi.mock('../src/git/service', () => ({
    getPrDiffSummary: vi.fn().mockResolvedValue({
        commitSummary: 'abc123 First commit',
        diffSummary: '3 files changed',
    }),
}))

describe('agents/pr-summary agentSummarizePullRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it('summarizes a pull request with resolved project, settings, agent, and profile', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {runInlineTask} = await import('../src/agents/inline')
        const {getPrDiffSummary} = await import('../src/git/service')
        const {agentSummarizePullRequest} = await import('../src/agents/pr-summary')

        const project = {
            id: 'proj-1',
            boardId: 'board-1',
            name: 'Test Project',
            status: 'Active' as const,
            createdAt: new Date().toISOString(),
            repositoryPath: '/repos/proj-1',
            repositoryUrl: null,
            repositorySlug: 'proj-1',
        }

        projectsService.get.mockResolvedValue(project)

        const settings = {
            projectId: 'proj-1',
            boardId: 'board-1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            defaultAgent: 'DROID',
            defaultProfileId: 'ap-1',
            inlineAgent: null,
            inlineProfileId: null,
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }

        ensureProjectSettings.mockResolvedValue(settings)

        const summaryResult = {title: 'PR Title', body: 'PR Body'}

        const inline = vi.fn().mockResolvedValue(summaryResult)
        const agent = {
            key: 'DROID',
            label: 'Droid',
            defaultProfile: {foo: 'bar'},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
            inline,
        }

        getAgent.mockReturnValue(agent)
        resolveAgentProfile.mockResolvedValue({profile: {foo: 'bar'}, label: 'Profile Label'})

        ;(runInlineTask as any).mockResolvedValue(summaryResult as any)

        const result = await agentSummarizePullRequest({
            projectId: 'proj-1',
            baseBranch: 'main',
            headBranch: 'feature/test',
            agentKey: 'DROID',
            profileId: 'ap-1',
        })

        expect(result).toEqual(summaryResult)

        expect(projectsService.get).toHaveBeenCalledWith('proj-1')
        expect(ensureProjectSettings).toHaveBeenCalledWith('proj-1')
        expect(getAgent).toHaveBeenCalledWith('DROID')
        expect(resolveAgentProfile).toHaveBeenCalledWith(agent, 'proj-1', 'ap-1')

        expect(runInlineTask).toHaveBeenCalledTimes(1)
        const [callArg] = (runInlineTask as any).mock.calls[0] as [any]
        expect(callArg).toMatchObject({
            agentKey: 'DROID',
            kind: 'prSummary',
        })
        expect(callArg.profile).toEqual({foo: 'bar'})
        expect(callArg.input).toMatchObject({
            repositoryPath: '/repos/proj-1',
            baseBranch: 'main',
            headBranch: 'feature/test',
        })
        expect(getPrDiffSummary).toHaveBeenCalledWith('proj-1', 'main', 'feature/test')
        expect(callArg.context).toMatchObject({
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/repos/proj-1',
            baseBranch: 'main',
            branchName: 'feature/test',
            agentKey: 'DROID',
            profileId: 'ap-1',
            profileSource: 'primary',
        })
    })

    it('throws when project is not found', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {agentSummarizePullRequest} = await import('../src/agents/pr-summary')

        projectsService.get.mockResolvedValue(null)

        await expect(
            agentSummarizePullRequest({
                projectId: 'missing-project',
                headBranch: 'feature/test',
            }),
        ).rejects.toThrow('Project not found')

        expect(ensureProjectSettings).not.toHaveBeenCalled()
    })

    it('throws when agent is unknown', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {agentSummarizePullRequest} = await import('../src/agents/pr-summary')

        projectsService.get.mockResolvedValue({
            id: 'proj-1',
            boardId: 'board-1',
            name: 'Test Project',
            status: 'Active',
            createdAt: new Date().toISOString(),
            repositoryPath: '/repos/proj-1',
            repositoryUrl: null,
            repositorySlug: 'proj-1',
        })

        ensureProjectSettings.mockResolvedValue({
            projectId: 'proj-1',
            boardId: 'board-1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            defaultAgent: 'DROID',
            defaultProfileId: null,
            inlineAgent: null,
            inlineProfileId: null,
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        getAgent.mockReturnValue(undefined)

        await expect(
            agentSummarizePullRequest({
                projectId: 'proj-1',
                headBranch: 'feature/test',
                agentKey: 'UNKNOWN',
            }),
        ).rejects.toThrow('Unknown agent: UNKNOWN')

        expect(resolveAgentProfile).not.toHaveBeenCalled()
    })

    it('prefers inline agent and profile when configured and no overrides provided', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {runInlineTask} = await import('../src/agents/inline')
        const {agentSummarizePullRequest} = await import('../src/agents/pr-summary')

        const project = {
            id: 'proj-1',
            boardId: 'board-1',
            name: 'Test Project',
            status: 'Active' as const,
            createdAt: new Date().toISOString(),
            repositoryPath: '/repos/proj-1',
            repositoryUrl: null,
            repositorySlug: 'proj-1',
        }

        projectsService.get.mockResolvedValue(project)

        ensureProjectSettings.mockResolvedValue({
            projectId: 'proj-1',
            boardId: 'board-1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            defaultAgent: 'IGNORED',
            defaultProfileId: 'ap-default',
            inlineAgent: 'CODEX',
            inlineProfileId: 'ap-inline',
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        const agent = {
            key: 'CODEX',
            label: 'Codex',
            defaultProfile: {foo: 'bar'},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
            inline: vi.fn(),
        }

        const summaryResult = {title: 'Inline PR', body: 'Inline PR body'}

        getAgent.mockReturnValue(agent)
        resolveAgentProfile.mockResolvedValue({
            profile: {foo: 'bar', inlineProfile: 'inline prompt'},
            label: 'Inline Profile',
        })
        ;(runInlineTask as any).mockResolvedValue(summaryResult as any)

        const result = await agentSummarizePullRequest({
            projectId: 'proj-1',
            headBranch: 'feature/inline',
        })

        expect(result).toEqual(summaryResult)
        expect(getAgent).toHaveBeenCalledWith('CODEX')
        expect(resolveAgentProfile).toHaveBeenCalledWith(agent, 'proj-1', 'ap-inline')

        const [callArg] = (runInlineTask as any).mock.calls[0] as [any]
        expect(callArg).toMatchObject({
            agentKey: 'CODEX',
            kind: 'prSummary',
        })
        expect(callArg.input).toMatchObject({
            repositoryPath: '/repos/proj-1',
            baseBranch: 'main',
            headBranch: 'feature/inline',
            // profileId is not part of PrSummaryInlineInput
        })
        expect(callArg.context).toMatchObject({
            agentKey: 'CODEX',
            profileId: 'ap-inline',
            profileSource: 'inline',
        })
    })

    it('prefers inline-agent-specific profile mapping for PR summaries', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {runInlineTask} = await import('../src/agents/inline')
        const {agentSummarizePullRequest} = await import('../src/agents/pr-summary')

        const project = {
            id: 'proj-1',
            boardId: 'board-1',
            name: 'Test Project',
            status: 'Active' as const,
            createdAt: new Date().toISOString(),
            repositoryPath: '/repos/proj-1',
            repositoryUrl: null,
            repositorySlug: 'proj-1',
        }

        projectsService.get.mockResolvedValue(project)

        ensureProjectSettings.mockResolvedValue({
            projectId: 'proj-1',
            boardId: 'board-1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            defaultAgent: 'IGNORED',
            defaultProfileId: 'ap-default',
            inlineAgent: 'CODEX',
            inlineProfileId: 'ap-inline',
            inlineAgentProfileMapping: {
                prSummary: 'ap-inline-pr-summary',
            },
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        const agent = {
            key: 'CODEX',
            label: 'Codex',
            defaultProfile: {foo: 'bar'},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
            inline: vi.fn(),
        }

        const summaryResult = {title: 'Mapped PR', body: 'Mapped PR body'}

        getAgent.mockReturnValue(agent)
        resolveAgentProfile.mockResolvedValue({
            profile: {foo: 'bar', inlineProfile: 'inline pr summary'},
            label: 'PR Summary Profile',
            warning: undefined,
        })
        ;(runInlineTask as any).mockResolvedValue(summaryResult as any)

        const result = await agentSummarizePullRequest({
            projectId: 'proj-1',
            headBranch: 'feature/inline-mapped',
        })

        expect(result).toEqual(summaryResult)
        expect(getAgent).toHaveBeenCalledWith('CODEX')
        expect(resolveAgentProfile).toHaveBeenCalledWith(
            agent,
            'proj-1',
            'ap-inline-pr-summary',
        )

        const [callArg] = (runInlineTask as any).mock.calls[0] as [any]
        expect(callArg.context).toMatchObject({
            agentKey: 'CODEX',
            profileId: 'ap-inline-pr-summary',
            profileSource: 'inline',
        })
    })

    it('falls back to default agent when no inline agent is configured and no override is provided', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {runInlineTask} = await import('../src/agents/inline')
        const {agentSummarizePullRequest} = await import('../src/agents/pr-summary')

        projectsService.get.mockResolvedValue({
            id: 'proj-1',
            boardId: 'board-1',
            name: 'Test Project',
            status: 'Active',
            createdAt: new Date().toISOString(),
            repositoryPath: '/repos/proj-1',
            repositoryUrl: null,
            repositorySlug: 'proj-1',
        })

        ensureProjectSettings.mockResolvedValue({
            projectId: 'proj-1',
            boardId: 'board-1',
            baseBranch: 'main',
            preferredRemote: null,
            setupScript: null,
            devScript: null,
            cleanupScript: null,
            copyFiles: null,
            defaultAgent: 'DROID',
            defaultProfileId: null,
            inlineAgent: null,
            inlineProfileId: null,
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        const agent = {
            key: 'DROID',
            label: 'Droid',
            defaultProfile: {foo: 'bar'},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
            inline: vi.fn(),
        }

        const summaryResult = {title: 'Default PR', body: 'Default PR body'}

        getAgent.mockReturnValue(agent)
        resolveAgentProfile.mockResolvedValue({profile: {foo: 'bar'}, label: 'Default Profile'})
        ;(runInlineTask as any).mockResolvedValue(summaryResult as any)

        const result = await agentSummarizePullRequest({
            projectId: 'proj-1',
            headBranch: 'feature/default',
        })

        expect(result).toEqual(summaryResult)
        expect(getAgent).toHaveBeenCalledWith('DROID')
        expect(resolveAgentProfile).not.toHaveBeenCalled()
    })
})
