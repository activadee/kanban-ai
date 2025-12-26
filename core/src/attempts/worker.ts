import {existsSync} from 'fs'
import type {
    AttemptStatus,
    ConversationItem,
    ConversationAutomationItem,
    AttemptTodoSummary,
    TicketType,
    AutomationStage,
} from 'shared'
import type {AppEventBus} from '../events/bus'
import {createWorktree} from '../ports/worktree'
import {getAgent} from '../agents/registry'
import type {Agent} from '../agents/types'
import {
    getNextConversationSeq,
    insertAttemptLog,
    insertConversationItem,
    updateAttempt,
    upsertAttemptTodos,
} from './repo'
import {
    createCleanupRunner,
    runAutomationStageInWorktree,
    isAutomationFailureAllowed,
} from './automation'
import {resolveAgentProfile} from './profiles'
import {getPlanForCard} from '../plans/repo'
import {buildPlanningAttemptDescription} from './planning-prompt'

type RunningAttemptMeta = {
    controller: AbortController
    aborted: boolean
    repoPath: string
    worktreePath: string
    boardId: string
}

const running = new Map<string, RunningAttemptMeta>()

export function abortRunningAttempt(id: string): RunningAttemptMeta | null {
    const meta = running.get(id)
    if (!meta) return null
    meta.aborted = true
    meta.controller.abort()
    return meta
}

export function getRunningAttemptMeta(id: string): RunningAttemptMeta | null {
    const meta = running.get(id)
    return meta ?? null
}

export type AttemptAutomationConfig = {
    copyScript: string | null
    setupScript: string | null
    cleanupScript: string | null
    allowScriptsToFail: boolean
    allowCopyFilesToFail: boolean
    allowSetupScriptToFail: boolean
    allowDevScriptToFail: boolean
    allowCleanupScriptToFail: boolean
}

type AttemptWorkerCommonParams = {
    attemptId: string
    boardId: string
    cardId: string
    agentKey: string
    repoPath: string
    worktreePath: string
    baseBranch: string
    branchName: string
    profileId?: string
    previousStatus: AttemptStatus
    cardTitle: string
    cardDescription: string | null
    ticketType?: TicketType | null
    isPlanningAttempt: boolean
    automation: AttemptAutomationConfig
}

export type StartAttemptWorkerParams = AttemptWorkerCommonParams

export type FollowupAttemptWorkerParams = AttemptWorkerCommonParams & {
    sessionId: string
    followupPrompt: string
}

type InternalWorkerParams =
    | (StartAttemptWorkerParams & {mode: 'run'})
    | (FollowupAttemptWorkerParams & {mode: 'resume'})

export function startAttemptWorker(
    params: StartAttemptWorkerParams,
    events: AppEventBus,
) {
    queueAttemptRun({...params, mode: 'run'}, events)
}

export function startFollowupAttemptWorker(
    params: FollowupAttemptWorkerParams,
    events: AppEventBus,
) {
    queueAttemptRun({...params, mode: 'resume'}, events)
}

async function resolveProfileForAgent<P>(
    agent: Agent<P>,
    projectId: string,
    profileId: string | undefined,
    log: (level: 'info' | 'warn' | 'error', message: string) => Promise<void>,
): Promise<P> {
    let profile: P = agent.defaultProfile
    const resolved = await resolveAgentProfile(agent, projectId, profileId)
    if (resolved.profile !== null && resolved.profile !== undefined) {
        profile = resolved.profile
        if (resolved.label) {
            await log(
                'info',
                `[profiles] using ${resolved.label} (${profileId}) for ${agent.key}`,
            )
        }
    } else if (resolved.warning) {
        await log('warn', resolved.warning)
    }
    return profile
}

function queueAttemptRun(params: InternalWorkerParams, events: AppEventBus) {
    const {
        attemptId,
        boardId,
        cardId,
        agentKey,
        repoPath,
        worktreePath,
        baseBranch,
        branchName,
        profileId,
        previousStatus,
        cardTitle,
        cardDescription,
        ticketType,
        isPlanningAttempt,
        automation,
    } = params

    queueMicrotask(async () => {
        let cleanupRunner: (() => Promise<void>) | null = null
        let currentStatus: AttemptStatus = 'running'
        try {
            await updateAttempt(attemptId, {
                status: 'running',
                startedAt: new Date(),
                updatedAt: new Date(),
            })
            events.publish('attempt.status.changed', {
                attemptId,
                boardId,
                cardId,
                status: 'running',
                previousStatus,
            })
            events.publish('attempt.started', {
                attemptId,
                boardId,
                cardId,
                agent: agentKey,
                branchName,
                baseBranch,
                worktreePath,
                profileId,
                isPlanningAttempt,
            })

            let worktreeCreated = false
            if (!existsSync(worktreePath)) {
                await createWorktree(repoPath, baseBranch, branchName, worktreePath, {
                    projectId: boardId,
                    attemptId,
                })
                worktreeCreated = true
            }

            const agent = getAgent(agentKey) as Agent<any> | undefined
            if (!agent) throw new Error(`Unknown agent: ${agentKey}`)

            let msgSeq = await getNextConversationSeq(attemptId)
            let effectiveCardDescription: string | null = cardDescription
            const emit = async (
                evt:
                    | {
                          type: 'log'
                          level?: 'info' | 'warn' | 'error'
                          message: string
                      }
                    | {type: 'status'; status: string}
                    | {type: 'session'; id: string}
                    | {type: 'conversation'; item: ConversationItem}
                    | {type: 'todo'; todos: AttemptTodoSummary},
            ) => {
                const metaNow = running.get(attemptId)
                const isAborted = !!metaNow?.aborted
                if (
                    isAborted &&
                    (evt.type === 'log' || evt.type === 'conversation')
                )
                    return
                if (evt.type === 'log') {
                    const ts = new Date()
                    await insertAttemptLog({
                        id: `log-${crypto.randomUUID()}`,
                        attemptId,
                        ts,
                        level: evt.level ?? 'info',
                        message: evt.message,
                    })
                    events.publish('attempt.log.appended', {
                        attemptId,
                        boardId,
                        level: evt.level ?? 'info',
                        message: evt.message,
                        ts: ts.toISOString(),
                    })
                } else if (evt.type === 'status') {
                    const nextStatus = evt.status as AttemptStatus
                    const previous = currentStatus
                    currentStatus = nextStatus
                    await updateAttempt(attemptId, {
                        status: nextStatus,
                        updatedAt: new Date(),
                    })
                    events.publish('attempt.status.changed', {
                        attemptId,
                        boardId,
                        cardId,
                        status: nextStatus,
                        previousStatus: previous,
                    })
                } else if (evt.type === 'conversation') {
                    const ts = new Date()
                    const recordId = `cmsg-${crypto.randomUUID()}`
                    const payloadItem: ConversationItem = {
                        ...evt.item,
                        id: recordId,
                        timestamp: evt.item.timestamp ?? ts.toISOString(),
                    }
                    await insertConversationItem({
                        id: recordId,
                        attemptId,
                        seq: msgSeq++,
                        ts,
                        itemJson: JSON.stringify(payloadItem),
                    })
                    events.publish('attempt.conversation.appended', {
                        attemptId,
                        boardId,
                        item: payloadItem,
                    })
                } else if (evt.type === 'todo') {
                    const todosJson = JSON.stringify(evt.todos)
                    await upsertAttemptTodos(attemptId, todosJson)
                    events.publish('attempt.todos.updated', {
                        attemptId,
                        boardId,
                        todos: evt.todos,
                    })
                } else if (evt.type === 'session') {
                    try {
                        await updateAttempt(attemptId, {
                            updatedAt: new Date(),
                            sessionId: evt.id,
                        })
                    } catch {}
                    try {
                        const ts = new Date()
                        const message = `[runner] recorded session id ${evt.id}`
                        await insertAttemptLog({
                            id: `log-${crypto.randomUUID()}`,
                            attemptId,
                            ts,
                            level: 'info',
                            message,
                        })
                        events.publish('attempt.log.appended', {
                            attemptId,
                            boardId,
                            level: 'info',
                            message,
                            ts: ts.toISOString(),
                        })
                    } catch {}
                    events.publish('attempt.session.recorded', {
                        attemptId,
                        boardId,
                        sessionId: evt.id,
                    })
                }
            }

            const allowFailureConfig = {
                allowScriptsToFail: automation.allowScriptsToFail,
                allowCopyFilesToFail: automation.allowCopyFilesToFail,
                allowSetupScriptToFail: automation.allowSetupScriptToFail,
                allowDevScriptToFail: automation.allowDevScriptToFail,
                allowCleanupScriptToFail: automation.allowCleanupScriptToFail,
            }

            const allowFailuresByStage: Record<AutomationStage, boolean> = {
                copy_files: isAutomationFailureAllowed(
                    'copy_files',
                    allowFailureConfig,
                ),
                setup: isAutomationFailureAllowed('setup', allowFailureConfig),
                dev: isAutomationFailureAllowed('dev', allowFailureConfig),
                cleanup: isAutomationFailureAllowed('cleanup', allowFailureConfig),
            }

            const automationEmit = async (item: ConversationAutomationItem) => {
                const allowedFailure =
                    item.status === 'failed' &&
                    allowFailuresByStage[item.stage]
                const payloadItem = allowedFailure
                    ? {...item, allowedFailure: true}
                    : item
                await emit({type: 'conversation', item: payloadItem})
                if (allowedFailure) {
                    await emit({
                        type: 'log',
                        level: 'warn',
                        message: `[automation:${item.stage}] failed but was allowed to fail; continuing.`,
                    })
                }
            }

            cleanupRunner = createCleanupRunner(
                automation.cleanupScript,
                worktreePath,
                automationEmit,
            )

            if (worktreeCreated && automation.copyScript) {
                await runAutomationStageInWorktree(
                    'copy_files',
                    automation.copyScript,
                    worktreePath,
                    automationEmit,
                    {failHard: !allowFailuresByStage.copy_files},
                )
            }
            if (automation.setupScript) {
                await runAutomationStageInWorktree(
                    'setup',
                    automation.setupScript,
                    worktreePath,
                    automationEmit,
                    {failHard: !allowFailuresByStage.setup},
                )
            }

            const ac = new AbortController()
            running.set(attemptId, {
                controller: ac,
                aborted: false,
                repoPath,
                worktreePath,
                boardId,
            })
            const log = async (
                level: 'info' | 'warn' | 'error',
                message: string,
            ) => emit({type: 'log', level, message})

            const profile = await resolveProfileForAgent(
                agent,
                boardId,
                profileId,
                log,
            )
            let effectiveProfile: unknown = profile

            if (params.mode === 'run') {
                if (isPlanningAttempt) {
                    const profileAppendPrompt = (() => {
                        if (!profile || typeof profile !== 'object') return ''
                        const value = (profile as Record<string, unknown>).appendPrompt
                        return typeof value === 'string' ? value.trim() : ''
                    })()

                    effectiveCardDescription = buildPlanningAttemptDescription(
                        cardDescription,
                        profileAppendPrompt || undefined,
                    )

                    if (profileAppendPrompt && profile && typeof profile === 'object') {
                        const base = profile as Record<string, unknown>
                        const inline = base.inlineProfile
                        const hasInline = typeof inline === 'string' && inline.trim().length > 0
                        const patch: Record<string, unknown> = {appendPrompt: null}
                        if (agentKey === 'OPENCODE' && !hasInline) {
                            patch.inlineProfile = profileAppendPrompt
                        }
                        effectiveProfile = {...base, ...patch}
                    }
                } else {
                    try {
                        const plan = await getPlanForCard(cardId)
                        const planMarkdown = plan?.planMarkdown?.trim()
                        if (planMarkdown) {
                            const original = effectiveCardDescription ?? ''
                            effectiveCardDescription = `## Plan\n\n${planMarkdown}\n\n---\n\n## Original Description\n\n${original}`
                        }
                    } catch (error) {
                        await emit({
                            type: 'log',
                            level: 'warn',
                            message: `[plans] failed to load plan: ${error instanceof Error ? error.message : String(error ?? 'unknown error')}`,
                        })
                    }
                }
            }

            if (params.mode === 'run') {
                const code =
                    typeof agent.run === 'function'
                        ? await agent.run(
                              {
                                  attemptId,
                                  boardId,
                                  cardId,
                                  worktreePath,
                                  repositoryPath: repoPath,
                                  branchName,
                                  baseBranch,
                                  cardTitle,
                                  cardDescription: effectiveCardDescription,
                                  ticketType,
                                  signal: ac.signal,
                                  emit,
                                  profileId: profileId ?? null,
                              } as any,
                              effectiveProfile as any,
                          )
                        : 1
                await log('info', `[runner] agent exited with code ${code}`)
                const final: AttemptStatus = getRunningAttemptMeta(attemptId)
                    ?.aborted
                    ? 'stopped'
                    : code === 0
                      ? 'succeeded'
                      : 'failed'
                const endedAt = new Date()
                await updateAttempt(attemptId, {
                    status: final,
                    endedAt,
                    updatedAt: endedAt,
                })
                events.publish('attempt.status.changed', {
                    attemptId,
                    boardId,
                    status: final,
                    previousStatus: 'running',
                    endedAt: endedAt.toISOString(),
                })
                events.publish('attempt.completed', {
                    attemptId,
                    boardId,
                    cardId,
                    status: final,
                    worktreePath,
                    profileId: profileId ?? undefined,
                    isPlanningAttempt,
                })
            } else {
                    if (typeof agent.resume !== 'function') {
                        throw new Error('Agent does not support follow-up')
                    }
                    try {
                        const code = await agent.resume(
                        {
                            attemptId,
                            boardId,
                            cardId,
                            worktreePath,
                            repositoryPath: repoPath,
                            branchName,
                            baseBranch,
                            cardTitle,
                            cardDescription: effectiveCardDescription,
                            ticketType,
                            signal: ac.signal,
                            emit,
                            sessionId: params.sessionId,
                            followupPrompt: params.followupPrompt,
                            profileId: profileId ?? null,
                        } as any,
                        effectiveProfile as any,
                    )
                    await emit({
                        type: 'log',
                        level: 'info',
                        message: `[runner] agent exited with code ${code}`,
                    })
                    await emit({
                        type: 'status',
                        status: code === 0 ? 'succeeded' : 'failed',
                    })
                } catch (err) {
                    await emit({
                        type: 'log',
                        level: 'error',
                        message: `[runner] failed: ${err instanceof Error ? err.message : String(err)}`,
                    })
                    await emit({type: 'status', status: 'failed'})
                }

                const endedAt = new Date()
                const finalStatus: AttemptStatus =
                    currentStatus === 'running' ? 'failed' : currentStatus
                if (currentStatus === 'running') {
                    await updateAttempt(attemptId, {
                        status: finalStatus,
                        endedAt,
                        updatedAt: endedAt,
                    })
                    events.publish('attempt.status.changed', {
                        attemptId,
                        boardId,
                        status: finalStatus,
                        previousStatus: currentStatus,
                        endedAt: endedAt.toISOString(),
                    })
                } else {
                    await updateAttempt(attemptId, {
                        endedAt,
                        updatedAt: endedAt,
                    })
                }
                events.publish('attempt.completed', {
                    attemptId,
                    boardId,
                    cardId,
                    status: finalStatus,
                    worktreePath,
                    profileId: profileId ?? undefined,
                    isPlanningAttempt,
                })
            }
        } catch (err) {
            const endedAt = new Date()
            await insertAttemptLog({
                id: `log-${crypto.randomUUID()}`,
                attemptId,
                ts: endedAt,
                level: 'error',
                message: `[runner] failed: ${err instanceof Error ? err.message : String(err)}`,
            })
            try {
                if (currentStatus === 'running') {
                    await updateAttempt(attemptId, {
                        status: 'failed',
                        endedAt,
                        updatedAt: endedAt,
                    })
                    events.publish('attempt.status.changed', {
                        attemptId,
                        boardId,
                        status: 'failed',
                        previousStatus: 'running',
                        endedAt: endedAt.toISOString(),
                    })
                    events.publish('attempt.completed', {
                        attemptId,
                        boardId,
                        cardId,
                        status: 'failed',
                        worktreePath,
                        profileId: profileId ?? undefined,
                        isPlanningAttempt,
                    })
                } else {
                    await updateAttempt(attemptId, {
                        endedAt,
                        updatedAt: endedAt,
                    })
                }
            } catch {}
        } finally {
            try {
                if (cleanupRunner) await cleanupRunner()
            } catch {}
            running.delete(attemptId)
        }
    })
}
