import type {AgentKey, Attempt, ConversationAutomationItem} from 'shared'
import {Bot, Server} from 'lucide-react'
import {formatRelativeTime} from '@/lib/time'
import type {ProcessEntry, ProcessStatus, ProcessAction} from '../types'
import {ProcessList} from '../ProcessList'

export type ActivitySectionProps = {
    attempt: Attempt | null
    agent: AgentKey
    stopping: boolean
    onStopAttempt: () => void
    latestDevAutomation: ConversationAutomationItem | null
    devScriptConfigured: boolean
    devAutomationPending: boolean
    onRunDevScript: () => void
    onViewLogs: () => void
}

export function ActivitySection({
                                    attempt,
                                    agent,
                                    stopping,
                                    onStopAttempt,
                                    latestDevAutomation,
                                    devScriptConfigured,
                                    devAutomationPending,
                                    onRunDevScript,
                                    onViewLogs,
                                }: ActivitySectionProps) {
    const entries: ProcessEntry[] = []

    const attemptStatus: ProcessStatus = attempt?.status ?? 'idle'
    const agentName = attempt?.agent ?? (agent || 'Agent')

    const agentDescriptionParts: string[] = []
    if (attempt?.branchName) agentDescriptionParts.push(`Branch ${attempt.branchName}`)
    if (attempt?.baseBranch) agentDescriptionParts.push(`Base ${attempt.baseBranch}`)
    const agentDescription = agentDescriptionParts.length
        ? agentDescriptionParts.join(' · ')
        : 'Kick off an agent run to automate this task.'

    const recentTs =
        attempt?.status === 'queued'
            ? attempt?.createdAt ?? attempt?.updatedAt
            : attempt?.updatedAt ?? attempt?.startedAt
    const relative = formatRelativeTime(recentTs)
    let agentMeta: string | null = null
    if (relative) {
        switch (attemptStatus) {
            case 'queued':
                agentMeta = `Queued ${relative}`
                break
            case 'running':
                agentMeta = `Updated ${relative}`
                break
            case 'stopping':
                agentMeta = `Stopping ${relative}`
                break
            case 'succeeded':
            case 'failed':
            case 'stopped':
                agentMeta = `Finished ${relative}`
                break
            default:
                agentMeta = null
        }
    }

    const agentActions: ProcessAction[] = []
    if (attempt && (attempt.status === 'running' || attempt.status === 'stopping')) {
        agentActions.push({
            id: 'stop-attempt',
            label: stopping || attempt.status === 'stopping' ? 'Stopping…' : 'Stop',
            onClick: () => {
                void onStopAttempt()
            },
            disabled: stopping || attempt.status === 'stopping',
            variant: 'outline',
        })
    }
    if (attempt) {
        agentActions.push({
            id: 'view-logs',
            label: 'View logs',
            onClick: onViewLogs,
            variant: 'ghost',
        })
    }

    entries.push({
        id: 'agent-run',
        icon: <Bot className="size-4"/>,
        name: `${agentName} run`,
        status: attemptStatus,
        description: agentDescription,
        meta: agentMeta,
        actions: agentActions,
    })

    const devStatus: ProcessStatus =
        devAutomationPending
            ? 'running'
            : latestDevAutomation
                ? latestDevAutomation.status === 'succeeded'
                    ? 'succeeded'
                    : latestDevAutomation.status === 'failed'
                        ? 'failed'
                        : 'idle'
                : 'idle'

    const devRelative = latestDevAutomation
        ? formatRelativeTime(latestDevAutomation.completedAt ?? latestDevAutomation.timestamp)
        : null

    const devMeta = (() => {
        if (!devScriptConfigured) return 'Configure a dev script in Project Settings.'
        if (!attempt) return 'Start an attempt to provision a worktree.'
        if (!latestDevAutomation) return 'Ready to launch.'
        const prefix = latestDevAutomation.status === 'succeeded' ? 'Succeeded' : 'Failed'
        return devRelative ? `${prefix} ${devRelative}` : prefix
    })()

    const devDescription = devScriptConfigured
        ? 'Start and monitor the project dev script.'
        : 'Add a dev script in Project Settings to enable quick launches.'

    entries.push({
        id: 'dev-server',
        icon: <Server className="size-4"/>,
        name: 'Dev script',
        status: devStatus,
        description: devDescription,
        meta: devMeta,
        actions: [
            {
                id: 'run-dev',
                label: devAutomationPending ? 'Running…' : 'Run dev',
                onClick: onRunDevScript,
                disabled: devAutomationPending || !devScriptConfigured || !attempt,
                variant: 'outline',
                tooltip: !devScriptConfigured
                    ? 'Configure a dev script in Project Settings.'
                    : !attempt
                        ? 'Start an attempt to create a worktree first.'
                        : undefined,
            },
        ],
    })

    return <ProcessList entries={entries}/>
}
