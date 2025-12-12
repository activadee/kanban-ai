import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {
    AgentContext,
    PrSummaryInlineInput,
    TicketEnhanceInput,
} from '../src/agents/types'
import {buildPrSummaryPrompt, buildTicketEnhancePrompt} from '../src/agents/utils'
import {OpencodeImpl, type OpencodeInstallation} from '../src/agents/opencode/core/agent'
import type {OpencodeProfile} from '../src/agents/opencode/profiles/schema'
import type {
    AssistantMessage,
    SessionCreateResponse,
    SessionPromptResponse,
} from '@opencode-ai/sdk'

class InlineTestOpencodeAgent extends OpencodeImpl {
    sessionCreateMock = vi.fn()
    sessionPromptMock = vi.fn()

    protected override async detectInstallation(
        _profile: OpencodeProfile,
        ctx: AgentContext,
    ): Promise<OpencodeInstallation> {
        return {mode: 'remote', directory: ctx.worktreePath, baseUrl: 'http://example', apiKey: 'test-key'}
    }

    protected override async createClient(
        _profile: OpencodeProfile,
        _ctx: AgentContext,
        _installation: OpencodeInstallation,
    ): Promise<unknown> {
        const client = {
            session: {
                create: this.sessionCreateMock,
                prompt: this.sessionPromptMock,
            },
        }
        return client
    }
}

describe('OpencodeAgent.enhance (inline ticketEnhance)', () => {
    let agent: InlineTestOpencodeAgent

    beforeEach(() => {
        agent = new InlineTestOpencodeAgent()
        agent.sessionCreateMock.mockReset()
        agent.sessionPromptMock.mockReset()
    })

    it('builds a ticket-enhancement prompt and splits markdown output', async () => {
        const controller = new AbortController()
        const input: TicketEnhanceInput = {
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            title: 'Original Title',
            description: 'Original Description',
            ticketType: 'feat',
            profileId: 'ap-1',
            signal: controller.signal,
        }

        const profile: OpencodeProfile = {
            appendPrompt: null,
            inlineProfile: null,
            agent: 'primary',
            model: 'test-provider/test-model',
            debug: false,
        }

        const basePrompt = buildTicketEnhancePrompt(
            input,
            profile.inlineProfile ?? profile.appendPrompt ?? undefined,
        )
        const inlineGuard =
            'IMPORTANT: Inline ticket enhancement only. Do not edit or create files. Respond only with Markdown, first line "# <Title>", remaining lines ticket body, no extra commentary.'
        const expectedPrompt = `${basePrompt}\n\n${inlineGuard}`

        const session: SessionCreateResponse = {
            id: 'sess-1',
            projectID: 'proj-1',
            directory: input.repositoryPath,
            title: input.title,
            version: 'v1',
            time: {created: Date.now(), updated: Date.now()},
        }
        agent.sessionCreateMock.mockResolvedValue(session)

        const markdown = '# Enhanced Title\nEnhanced body'
        const assistantMessage: AssistantMessage = {
            id: 'msg-1',
            sessionID: session.id,
            role: 'assistant',
            time: {created: Date.now()},
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'default',
            path: {cwd: input.repositoryPath, root: input.repositoryPath},
            cost: 0,
            tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {read: 0, write: 0},
            },
        }
        const promptResponse: SessionPromptResponse = {
            info: assistantMessage,
            parts: [
                {
                    id: 'part-1',
                    sessionID: session.id,
                    messageID: assistantMessage.id,
                    type: 'text',
                    text: markdown,
                },
            ],
        }
        agent.sessionPromptMock.mockResolvedValue(promptResponse)

        const result = await agent.enhance(input, profile)

        expect(agent.sessionCreateMock).toHaveBeenCalledTimes(1)
        const createCall = agent.sessionCreateMock.mock.calls[0][0]
        expect(createCall.query).toEqual({directory: input.repositoryPath})
        expect(createCall.body).toMatchObject({title: input.title})
        expect(createCall.responseStyle).toBe('data')
        expect(createCall.throwOnError).toBe(true)

        expect(agent.sessionPromptMock).toHaveBeenCalledTimes(1)
        const promptCall = agent.sessionPromptMock.mock.calls[0][0]
        expect(promptCall.path).toEqual({id: session.id})
        expect(promptCall.query).toEqual({directory: input.repositoryPath})
        expect(promptCall.body.agent).toBe(profile.agent)
        expect(promptCall.body.model).toEqual({providerID: 'test-provider', modelID: 'test-model'})
        expect(promptCall.body.system).toBeUndefined()
        expect(promptCall.body.parts).toEqual([
            {
                type: 'text',
                text: expectedPrompt,
            },
        ])
        expect(promptCall.signal).toBe(controller.signal)
        expect(promptCall.responseStyle).toBe('data')
        expect(promptCall.throwOnError).toBe(true)

        expect(result).toEqual({
            title: 'Enhanced Title',
            description: 'Enhanced body',
        })
    })

    it('prefers inlineProfile over appendPrompt when building prompts', async () => {
        const controller = new AbortController()
        const input: TicketEnhanceInput = {
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            title: 'Original Title',
            description: 'Original Description',
            ticketType: null,
            profileId: 'ap-1',
            signal: controller.signal,
        }

        const profile: OpencodeProfile = {
            appendPrompt: 'base append',
            inlineProfile: 'inline-only',
            agent: 'primary',
            model: 'provider/model',
            debug: false,
        }

        const expectedAppend = profile.inlineProfile
        const basePrompt = buildTicketEnhancePrompt(input, expectedAppend ?? undefined)
        const inlineGuard =
            'IMPORTANT: Inline ticket enhancement only. Do not edit or create files. Respond only with Markdown, first line "# <Title>", remaining lines ticket body, no extra commentary.'
        const expectedPrompt = `${basePrompt}\n\n${inlineGuard}`

        const session: SessionCreateResponse = {
            id: 'sess-2',
            projectID: 'proj-1',
            directory: input.repositoryPath,
            title: input.title,
            version: 'v1',
            time: {created: Date.now(), updated: Date.now()},
        }
        agent.sessionCreateMock.mockResolvedValue(session)

        const markdown = '# Enhanced Title\nEnhanced body'
        const assistantMessage: AssistantMessage = {
            id: 'msg-2',
            sessionID: session.id,
            role: 'assistant',
            time: {created: Date.now()},
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'default',
            path: {cwd: input.repositoryPath, root: input.repositoryPath},
            cost: 0,
            tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {read: 0, write: 0},
            },
        }
        const promptResponse: SessionPromptResponse = {
            info: assistantMessage,
            parts: [
                {
                    id: 'part-2',
                    sessionID: session.id,
                    messageID: assistantMessage.id,
                    type: 'text',
                    text: markdown,
                },
            ],
        }
        agent.sessionPromptMock.mockResolvedValue(promptResponse)

        const result = await agent.enhance(input, profile)

        expect(agent.sessionPromptMock).toHaveBeenCalledTimes(1)
        const promptCall = agent.sessionPromptMock.mock.calls[0][0]
        expect(promptCall.body.system).toBe('inline-only')
        expect(promptCall.body.parts[0]?.text).toBe(expectedPrompt)

        expect(result).toEqual({
            title: 'Enhanced Title',
            description: 'Enhanced body',
        })
    })

    it('falls back to original title/description when markdown is empty', async () => {
        const controller = new AbortController()
        const input: TicketEnhanceInput = {
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            title: 'Original Title',
            description: 'Original Description',
            ticketType: null,
            profileId: 'ap-1',
            signal: controller.signal,
        }

        const profile: OpencodeProfile = {
            appendPrompt: null,
            inlineProfile: null,
            agent: 'primary',
            model: 'provider/model',
            debug: false,
        }

        const session: SessionCreateResponse = {
            id: 'sess-3',
            projectID: 'proj-1',
            directory: input.repositoryPath,
            title: input.title,
            version: 'v1',
            time: {created: Date.now(), updated: Date.now()},
        }
        agent.sessionCreateMock.mockResolvedValue(session)

        const assistantMessage: AssistantMessage = {
            id: 'msg-3',
            sessionID: session.id,
            role: 'assistant',
            time: {created: Date.now()},
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'default',
            path: {cwd: input.repositoryPath, root: input.repositoryPath},
            cost: 0,
            tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {read: 0, write: 0},
            },
        }
        const promptResponse: SessionPromptResponse = {
            info: assistantMessage,
            parts: [
                {
                    id: 'part-3',
                    sessionID: session.id,
                    messageID: assistantMessage.id,
                    type: 'text',
                    text: '',
                },
            ],
        }
        agent.sessionPromptMock.mockResolvedValue(promptResponse)

        const result = await agent.enhance(input, profile)

        expect(result).toEqual({
            title: input.title,
            description: input.description,
        })
    })
})

describe('OpencodeAgent.summarizePullRequest (inline prSummary)', () => {
    let agent: InlineTestOpencodeAgent

    beforeEach(() => {
        agent = new InlineTestOpencodeAgent()
        agent.sessionCreateMock.mockReset()
        agent.sessionPromptMock.mockReset()
    })

    it('builds a PR-summary prompt and maps markdown to title/body', async () => {
        const controller = new AbortController()
        const input: PrSummaryInlineInput = {
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
            commitSummary: 'abc123 Add feature',
            diffSummary: '3 files changed',
        }

        const profile: OpencodeProfile = {
            appendPrompt: null,
            inlineProfile: null,
            agent: 'primary',
            model: 'provider/model',
            debug: false,
        }

        const basePrompt = buildPrSummaryPrompt(
            input,
            profile.inlineProfile ?? profile.appendPrompt ?? undefined,
        )
        const inlineGuard =
            'IMPORTANT: Inline PR summary only. Do not edit or create files. Respond only with Markdown, first line "# <Title>", remaining lines PR body, no extra commentary.'
        const expectedPrompt = `${basePrompt}\n\n${inlineGuard}`

        const session: SessionCreateResponse = {
            id: 'sess-pr-1',
            projectID: 'proj-1',
            directory: input.repositoryPath,
            title: `PR from ${input.headBranch} into ${input.baseBranch}`,
            version: 'v1',
            time: {created: Date.now(), updated: Date.now()},
        }
        agent.sessionCreateMock.mockResolvedValue(session)

        const markdown = '# PR Title\nPR body'
        const assistantMessage: AssistantMessage = {
            id: 'msg-pr-1',
            sessionID: session.id,
            role: 'assistant',
            time: {created: Date.now()},
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'default',
            path: {cwd: input.repositoryPath, root: input.repositoryPath},
            cost: 0,
            tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {read: 0, write: 0},
            },
        }
        const promptResponse: SessionPromptResponse = {
            info: assistantMessage,
            parts: [
                {
                    id: 'part-pr-1',
                    sessionID: session.id,
                    messageID: assistantMessage.id,
                    type: 'text',
                    text: markdown,
                },
            ],
        }
        agent.sessionPromptMock.mockResolvedValue(promptResponse)

        const result = await agent.summarizePullRequest(input, profile, controller.signal)

        expect(agent.sessionCreateMock).toHaveBeenCalledTimes(1)
        const createCall = agent.sessionCreateMock.mock.calls[0][0]
        expect(createCall.query).toEqual({directory: input.repositoryPath})
        expect(createCall.body).toMatchObject({
            title: `PR from ${input.headBranch} into ${input.baseBranch}`,
        })
        expect(createCall.responseStyle).toBe('data')
        expect(createCall.throwOnError).toBe(true)

        expect(agent.sessionPromptMock).toHaveBeenCalledTimes(1)
        const promptCall = agent.sessionPromptMock.mock.calls[0][0]
        expect(promptCall.path).toEqual({id: session.id})
        expect(promptCall.query).toEqual({directory: input.repositoryPath})
        expect(promptCall.body.agent).toBe(profile.agent)
        expect(promptCall.body.model).toEqual({providerID: 'provider', modelID: 'model'})
        expect(promptCall.body.system).toBeUndefined()
        expect(promptCall.body.parts).toEqual([
            {
                type: 'text',
                text: expectedPrompt,
            },
        ])
        expect(promptCall.signal).toBe(controller.signal)
        expect(promptCall.responseStyle).toBe('data')
        expect(promptCall.throwOnError).toBe(true)

        expect(result).toEqual({
            title: 'PR Title',
            body: 'PR body',
        })
    })

    it('falls back to branch-derived title/body when markdown is empty', async () => {
        const controller = new AbortController()
        const input: PrSummaryInlineInput = {
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/empty',
            commitSummary: undefined,
            diffSummary: undefined,
        }

        const profile: OpencodeProfile = {
            appendPrompt: null,
            inlineProfile: null,
            agent: 'primary',
            model: 'provider/model',
            debug: false,
        }

        const session: SessionCreateResponse = {
            id: 'sess-pr-2',
            projectID: 'proj-1',
            directory: input.repositoryPath,
            title: `PR from ${input.headBranch} into ${input.baseBranch}`,
            version: 'v1',
            time: {created: Date.now(), updated: Date.now()},
        }
        agent.sessionCreateMock.mockResolvedValue(session)

        const assistantMessage: AssistantMessage = {
            id: 'msg-pr-2',
            sessionID: session.id,
            role: 'assistant',
            time: {created: Date.now()},
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'default',
            path: {cwd: input.repositoryPath, root: input.repositoryPath},
            cost: 0,
            tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {read: 0, write: 0},
            },
        }
        const promptResponse: SessionPromptResponse = {
            info: assistantMessage,
            parts: [
                {
                    id: 'part-pr-2',
                    sessionID: session.id,
                    messageID: assistantMessage.id,
                    type: 'text',
                    text: '',
                },
            ],
        }
        agent.sessionPromptMock.mockResolvedValue(promptResponse)

        const result = await agent.summarizePullRequest(input, profile, controller.signal)

        expect(result).toEqual({
            title: `PR from ${input.headBranch} into ${input.baseBranch}`,
            body: `Changes from ${input.baseBranch} to ${input.headBranch} in ${input.repositoryPath}`,
        })
    })
})
