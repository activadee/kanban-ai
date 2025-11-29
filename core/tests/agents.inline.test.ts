import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../src/agents/registry', () => ({
    getAgent: vi.fn(),
}))

describe('agents/inline runInlineTask', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it('invokes agent.inline for ticketEnhance and returns result', async () => {
        const {getAgent} = await import('../src/agents/registry')
        const {runInlineTask} = await import('../src/agents/inline')

        const inline = vi.fn().mockResolvedValue({
            title: 'Enhanced Title',
            description: 'Enhanced Description',
        })

        const agent = {
            key: 'DROID',
            label: 'Droid',
            defaultProfile: {},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
            inline,
        }

        ;(getAgent as any).mockReturnValue(agent)

        const controller = new AbortController()

        const result = await runInlineTask({
            agentKey: 'DROID',
            kind: 'ticketEnhance',
            input: {
                projectId: 'proj-1',
                boardId: 'board-1',
                repositoryPath: '/tmp/repo',
                baseBranch: 'main',
                title: 'Original Title',
                description: 'Original Description',
                profileId: 'ap-1',
                signal: controller.signal,
            },
            profile: {foo: 'bar'},
            context: {
                projectId: 'proj-1',
                boardId: 'board-1',
                repositoryPath: '/tmp/repo',
                baseBranch: 'main',
                branchName: 'main',
                headCommit: null,
                agentKey: 'DROID',
                profileId: 'ap-1',
            },
            signal: controller.signal,
        })

        expect(result).toEqual({
            title: 'Enhanced Title',
            description: 'Enhanced Description',
        })

        expect(inline).toHaveBeenCalledTimes(1)
        const [kindArg, inputArg, profileArg, optsArg] = inline.mock
            .calls[0] as [string, any, any, {context: any; signal?: AbortSignal}]
        expect(kindArg).toBe('ticketEnhance')
        expect(inputArg).toMatchObject({
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            title: 'Original Title',
            description: 'Original Description',
            profileId: 'ap-1',
        })
        expect(profileArg).toEqual({foo: 'bar'})
        expect(optsArg.context).toMatchObject({
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            branchName: 'main',
            agentKey: 'DROID',
            profileId: 'ap-1',
        })
        expect(optsArg.signal).toBeDefined()
        expect(typeof optsArg.signal?.aborted).toBe('boolean')
    })

    it('throws InlineTaskError for unknown agent', async () => {
        const {getAgent} = await import('../src/agents/registry')
        const {runInlineTask} = await import('../src/agents/inline')
        const {InlineTaskError} = await import('../src/agents/types')

        ;(getAgent as any).mockReturnValue(undefined)

        await expect(
            runInlineTask({
                agentKey: 'UNKNOWN',
                kind: 'ticketEnhance',
                input: {
                    projectId: 'proj-1',
                    boardId: 'board-1',
                    repositoryPath: '/tmp/repo',
                    baseBranch: 'main',
                    title: 'Original Title',
                    description: 'Original Description',
                    profileId: null,
                    signal: new AbortController().signal,
                },
                profile: {},
                context: {
                    projectId: 'proj-1',
                    boardId: 'board-1',
                    repositoryPath: '/tmp/repo',
                    baseBranch: 'main',
                    branchName: 'main',
                    headCommit: null,
                    agentKey: 'UNKNOWN',
                    profileId: null,
                },
            }),
        ).rejects.toMatchObject({
            constructor: InlineTaskError,
            code: 'UNKNOWN_AGENT',
            agent: 'UNKNOWN',
            kind: 'ticketEnhance',
        })
    })

    it('throws InlineTaskError when agent has no inline()', async () => {
        const {getAgent} = await import('../src/agents/registry')
        const {runInlineTask} = await import('../src/agents/inline')
        const {InlineTaskError} = await import('../src/agents/types')

        const agent = {
            key: 'CODEX',
            label: 'Codex',
            defaultProfile: {},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
        }

        ;(getAgent as any).mockReturnValue(agent)

        await expect(
            runInlineTask({
                agentKey: 'CODEX',
                kind: 'ticketEnhance',
                input: {
                    projectId: 'proj-1',
                    boardId: 'board-1',
                    repositoryPath: '/tmp/repo',
                    baseBranch: 'main',
                    title: 'Original Title',
                    description: 'Original Description',
                    profileId: null,
                    signal: new AbortController().signal,
                },
                profile: {},
                context: {
                    projectId: 'proj-1',
                    boardId: 'board-1',
                    repositoryPath: '/tmp/repo',
                    baseBranch: 'main',
                    branchName: 'main',
                    headCommit: null,
                    agentKey: 'CODEX',
                    profileId: null,
                },
            }),
        ).rejects.toMatchObject({
            constructor: InlineTaskError,
            code: 'AGENT_NO_INLINE',
            agent: 'CODEX',
            kind: 'ticketEnhance',
        })
    })

    it('wraps AbortError rejections as InlineTaskError with code ABORTED', async () => {
        const {getAgent} = await import('../src/agents/registry')
        const {runInlineTask} = await import('../src/agents/inline')
        const {InlineTaskError} = await import('../src/agents/types')

        const inline = vi.fn().mockImplementation(async () => {
            const err = new Error('Operation aborted')
            ;(err as any).name = 'AbortError'
            throw err
        })

        const agent = {
            key: 'DROID',
            label: 'Droid',
            defaultProfile: {},
            profileSchema: {safeParse: vi.fn()} as any,
            run: vi.fn(),
            inline,
        }

        ;(getAgent as any).mockReturnValue(agent)

        await expect(
            runInlineTask({
                agentKey: 'DROID',
                kind: 'ticketEnhance',
                input: {
                    projectId: 'proj-1',
                    boardId: 'board-1',
                    repositoryPath: '/tmp/repo',
                    baseBranch: 'main',
                    title: 'Original Title',
                    description: 'Original Description',
                    profileId: 'ap-1',
                    signal: new AbortController().signal,
                },
                profile: {},
                context: {
                    projectId: 'proj-1',
                    boardId: 'board-1',
                    repositoryPath: '/tmp/repo',
                    baseBranch: 'main',
                    branchName: 'main',
                    headCommit: null,
                    agentKey: 'DROID',
                    profileId: 'ap-1',
                },
            }),
        ).rejects.toMatchObject({
            constructor: InlineTaskError,
            code: 'ABORTED',
            agent: 'DROID',
            kind: 'ticketEnhance',
        })
    })
})
