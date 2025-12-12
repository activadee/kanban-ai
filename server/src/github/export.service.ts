import {githubRepo, getGitOriginUrl, parseGithubOwnerRepo} from 'core'
import {createRepoIssue} from './api'
import {log} from '../log'

export type ExportGithubIssueParams = {
    boardId: string
    cardId: string
    repositoryPath: string
    title: string
    description?: string | null
    ticketKey?: string | null
}

export async function createGithubIssueForCard(params: ExportGithubIssueParams): Promise<{
    issueNumber: number
    url: string
}> {
    const originUrl = await getGitOriginUrl(params.repositoryPath)
    if (!originUrl) {
        throw new Error('No origin remote configured')
    }

    const parsed = parseGithubOwnerRepo(originUrl)
    if (!parsed) {
        throw new Error('Unsupported remote origin for GitHub operations')
    }

    const issueTitle = params.ticketKey ? `[${params.ticketKey}] ${params.title}` : params.title
    const description = params.description?.trim() ?? ''
    const body =
        description.length > 0
            ? description
            : params.ticketKey
              ? `Created from KanbanAI ticket ${params.ticketKey}.`
              : `Created from KanbanAI card ${params.cardId}.`

    const issue = await createRepoIssue({
        owner: parsed.owner,
        repo: parsed.repo,
        title: issueTitle,
        body,
    })

    const now = new Date()
    try {
        await githubRepo.insertGithubIssueMapping({
            id: `ghi-${crypto.randomUUID()}`,
            boardId: params.boardId,
            cardId: params.cardId,
            owner: parsed.owner,
            repo: parsed.repo,
            direction: 'exported',
            issueId: String(issue.id),
            issueNumber: issue.number,
            titleSnapshot: issue.title,
            url: issue.html_url,
            state: issue.state,
            createdAt: now,
            updatedAt: now,
        })
    } catch (error) {
        log.error('github:export', 'Failed to persist GitHub issue mapping', {
            err: error,
            boardId: params.boardId,
            cardId: params.cardId,
            owner: parsed.owner,
            repo: parsed.repo,
            issueNumber: issue.number,
        })
        throw error
    }

    return {issueNumber: issue.number, url: issue.html_url}
}

