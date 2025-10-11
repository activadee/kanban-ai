import simpleGit, {type SimpleGit} from 'simple-git'
import type {AppEventBus} from '../events/bus'
import {insertAttemptLog, listConversationItemsDescending} from './repo'
import {getCardById} from '../projects/repo'
import {ensureGitAuthorIdentity} from '../git/service'

type SimpleGitCommitResult = Awaited<ReturnType<SimpleGit['commit']>>

function normalizeSha(value: string | null): string | null {
    if (!value) return null
    const trimmed = value.trim()
    return /^[0-9a-f]{7,40}$/i.test(trimmed) ? trimmed : null
}

function extractShaFromCommitResult(result: SimpleGitCommitResult): string | null {

    if (result && typeof result === 'object' && 'commit' in result) {
        const commitValue = (result as any).commit
        if (typeof commitValue === 'string') return normalizeSha(commitValue)
    }
    return null
}

function sanitizeCommitText(input: string): string {
    let text = input.replace(/```[\s\S]*?```/g, '')
    text = text.replace(/`+/g, '')
    text = text.replace(/[\t ]+/g, ' ')
    text = text.replace(/\n{3,}/g, '\n\n')
    return text.trim()
}

async function buildAutoCommitMessage(attemptId: string, cardId: string, profileId?: string | null): Promise<string> {
    const rows = await listConversationItemsDescending(attemptId, 200)
    let text = ''
    for (const row of rows) {
        try {
            const item = JSON.parse(row.itemJson) as { type?: string; role?: string; text?: string }
            if (item?.type === 'message' && (item.role === 'assistant' || !item.role)) {
                text = String(item.text ?? '')
                if (text) break
            }
        } catch {
        }
    }

    if (!text) {
        const card = await getCardById(cardId)
        text = card?.title ? `feat: ${card.title}` : 'chore: agent changes'
    }

    const sanitized = sanitizeCommitText(text)
    const [subjectLine, ...rest] = sanitized.split('\n')
    const subject = (subjectLine || 'chore: agent changes').slice(0, 72)
    const bodyRaw = rest.join('\n').trim()
    const body = bodyRaw ? bodyRaw.slice(0, 1200) : ''

    let message = subject
    if (body) message += `\n\n${body}`
    message += `\n\nAttempt: ${attemptId}`
    if (profileId) message += `\nProfile: ${profileId}`
    return message
}

type AutoCommitParams = {
    attemptId: string
    boardId: string
    cardId: string
    worktreePath: string
    profileId?: string | null
    events: AppEventBus
}

export async function performAutoCommit(params: AutoCommitParams) {
    const {attemptId, boardId, cardId, worktreePath, profileId, events} = params
    const git = simpleGit({baseDir: worktreePath})
    const status = await git.status()
    const hasChanges =
        status.files.length > 0 ||
        status.not_added.length > 0 ||
        status.created.length > 0 ||
        status.modified.length > 0 ||
        status.deleted.length > 0
    if (!hasChanges) return

    const message = await buildAutoCommitMessage(attemptId, cardId, profileId ?? undefined)
    await ensureGitAuthorIdentity(git)
    await git.add(['-A'])
    const previousHead = await git.revparse(['HEAD']).catch(() => null)
    const result = await git.commit(message)
    let sha = extractShaFromCommitResult(result)
    const currentHead = await git.revparse(['HEAD']).catch(() => null)

    if (!sha && currentHead && currentHead !== previousHead) {
        sha = currentHead.trim()
    }

    if (!sha) {
        const summary = (result && typeof result === 'object' && 'summary' in result) ? (result as any).summary ?? {} : {}
        const {changes = 0, insertions = 0, deletions = 0} = summary as {
            changes?: number; insertions?: number; deletions?: number
        }
        if (!changes && !insertions && !deletions) {
            throw new Error('Auto-commit failed: no staged changes.')
        }
        if (currentHead) sha = currentHead.trim()
    }

    if (!sha) throw new Error('Auto-commit failed: commit hash unavailable')
    const shortSha = sha.substring(0, 7)
    const timestamp = new Date()
    const logMessage = `[autocommit] committed ${shortSha ? shortSha + ' ' : ''}${message.split('\n')[0]}`

    await insertAttemptLog({
        id: `log-${crypto.randomUUID()}`,
        attemptId,
        ts: timestamp,
        level: 'info',
        message: logMessage,
    })

    events.publish('attempt.log.appended', {
        attemptId,
        boardId,
        level: 'info',
        message: logMessage,
        ts: timestamp.toISOString(),
    })
}
