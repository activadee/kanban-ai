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

describe('agents/enhance agentEnhanceTicket', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it('enhances a ticket with resolved project, settings, agent, and profile', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {runInlineTask} = await import('../src/agents/inline')
        const {agentEnhanceTicket} = await import('../src/agents/enhance')

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
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }

        ensureProjectSettings.mockResolvedValue(settings)

        const enhanceResult = {title: 'Enhanced Title', description: 'Enhanced Description'}

        const inline = vi.fn().mockResolvedValue(enhanceResult)
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

        ;(runInlineTask as any).mockResolvedValue(enhanceResult as any)

        const result = await agentEnhanceTicket({
            projectId: 'proj-1',
            title: 'Original Title',
            description: 'Original Description',
            agentKey: 'DROID',
            profileId: 'ap-1',
        })

        expect(result).toEqual(enhanceResult)

        expect(projectsService.get).toHaveBeenCalledWith('proj-1')
        expect(ensureProjectSettings).toHaveBeenCalledWith('proj-1')
        expect(getAgent).toHaveBeenCalledWith('DROID')
        expect(resolveAgentProfile).toHaveBeenCalledWith(agent, 'proj-1', 'ap-1')
        expect(inline).not.toHaveBeenCalled()

        expect(runInlineTask).toHaveBeenCalledTimes(1)
        const [callArg] = (runInlineTask as any).mock.calls[0] as [any]
        expect(callArg).toMatchObject({
            agentKey: 'DROID',
            kind: 'ticketEnhance',
        })
        expect(callArg.profile).toEqual({foo: 'bar'})
        expect(callArg.input).toMatchObject({
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/repos/proj-1',
            baseBranch: 'main',
            title: 'Original Title',
            description: 'Original Description',
            profileId: 'ap-1',
        })
        expect(callArg.input.signal).toBeDefined()
        expect(typeof callArg.input.signal.aborted).toBe('boolean')
        expect(callArg.context).toMatchObject({
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/repos/proj-1',
            baseBranch: 'main',
            branchName: 'main',
            agentKey: 'DROID',
            profileId: 'ap-1',
            profileSource: 'primary',
        })
    })

    it('throws when project is not found', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {agentEnhanceTicket} = await import('../src/agents/enhance')

        projectsService.get.mockResolvedValue(null)

        await expect(
            agentEnhanceTicket({
                projectId: 'missing-project',
                title: 'Title',
                description: 'Description',
            }),
        ).rejects.toThrow('Project not found')

        expect(ensureProjectSettings).not.toHaveBeenCalled()
    })

    it('throws when agent is unknown', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {agentEnhanceTicket} = await import('../src/agents/enhance')

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
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        getAgent.mockReturnValue(undefined)

        await expect(
            agentEnhanceTicket({
                projectId: 'proj-1',
                title: 'Title',
                description: 'Description',
                agentKey: 'UNKNOWN',
            }),
        ).rejects.toThrow('Unknown agent: UNKNOWN')

        expect(resolveAgentProfile).not.toHaveBeenCalled()
    })

    it('throws when agent does not implement enhance()', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {agentEnhanceTicket} = await import('../src/agents/enhance')

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
            defaultAgent: 'CODEX',
            defaultProfileId: null,
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: 'PRJ',
            nextTicketNumber: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        const agentWithoutEnhance = {
            key: 'CODEX',
            label: 'Codex',
            defaultProfile: {},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
        }

        getAgent.mockReturnValue(agentWithoutEnhance)

        await expect(
            agentEnhanceTicket({
                projectId: 'proj-1',
                title: 'Title',
                description: 'Description',
                agentKey: 'CODEX',
            }),
        ).rejects.toThrow('Agent CODEX does not support ticket enhancement')

        expect(resolveAgentProfile).not.toHaveBeenCalled()
    })

    it('uses inline agent and profile from project settings when no overrides are provided', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {runInlineTask} = await import('../src/agents/inline')
        const {agentEnhanceTicket} = await import('../src/agents/enhance')

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
            inlineAgent: 'DROID',
            inlineProfileId: 'ap-inline',
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

        const enhanceResult = {title: 'Enhanced', description: 'Enhanced description'}

        getAgent.mockReturnValue(agent)
        resolveAgentProfile.mockResolvedValue({
            profile: {foo: 'bar', inlineProfile: 'inline prompt'},
            label: 'Inline Profile',
        })
        ;(runInlineTask as any).mockResolvedValue(enhanceResult as any)

        const result = await agentEnhanceTicket({
            projectId: 'proj-1',
            title: 'Title',
            description: 'Description',
        })

        expect(result).toEqual(enhanceResult)
        expect(getAgent).toHaveBeenCalledWith('DROID')
        expect(resolveAgentProfile).toHaveBeenCalledWith(agent, 'proj-1', 'ap-inline')

        const [callArg] = (runInlineTask as any).mock.calls[0] as [any]
        expect(callArg).toMatchObject({
            agentKey: 'DROID',
            kind: 'ticketEnhance',
        })
        expect(callArg.input).toMatchObject({
            projectId: 'proj-1',
            boardId: 'board-1',
            profileId: 'ap-inline',
        })
        expect(callArg.context).toMatchObject({
            agentKey: 'DROID',
            profileId: 'ap-inline',
            profileSource: 'inline',
        })
    })

    it('falls back to default agent when no inline agent is configured and no override is provided', async () => {
        const {projectsService} = await import('../src/projects/service')
        const {ensureProjectSettings} = await import('../src/projects/settings/service')
        const {getAgent} = await import('../src/agents/registry')
        const {resolveAgentProfile} = await import('../src/agents/profile-resolution')
        const {runInlineTask} = await import('../src/agents/inline')
        const {agentEnhanceTicket} = await import('../src/agents/enhance')

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

        const enhanceResult = {title: 'Enhanced Fallback', description: 'Enhanced description via default agent'}

        getAgent.mockReturnValue(agent)
        resolveAgentProfile.mockResolvedValue({profile: {foo: 'bar'}, label: 'Default Profile'})
        ;(runInlineTask as any).mockResolvedValue(enhanceResult as any)

        const result = await agentEnhanceTicket({
            projectId: 'proj-1',
            title: 'Title',
            description: 'Description',
        })

        expect(result).toEqual(enhanceResult)
        expect(getAgent).toHaveBeenCalledWith('DROID')
        expect(resolveAgentProfile).not.toHaveBeenCalled()
    })
})
