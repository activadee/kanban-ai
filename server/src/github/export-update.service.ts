import {githubRepo} from 'core'
import {updateRepoIssue} from './api'
import {log} from '../log'

export async function updateGithubIssueForCard(cardId: string, patch: {
    title?: string
    description?: string | null
}): Promise<void> {
    const mapping = await githubRepo.findGithubIssueMappingByCardId(cardId)
    if (!mapping) return
    if (mapping.direction !== 'exported') return

    const nextTitle = patch.title?.trim()
    const nextDescription =
        patch.description === undefined ? undefined : patch.description?.trim() ?? null

    if (nextTitle === undefined && nextDescription === undefined) return

    const updated = await updateRepoIssue({
        owner: mapping.owner,
        repo: mapping.repo,
        issueNumber: mapping.issueNumber,
        title: nextTitle,
        body: nextDescription,
    })

    const now = new Date()
    try {
        await githubRepo.updateGithubIssueMapping(mapping.id, {
            titleSnapshot: updated.title,
            state: updated.state,
            updatedAt: now,
        })
    } catch (error) {
        log.warn('github:export', 'Failed to update mapping after issue update', {
            err: error,
            cardId,
            issueNumber: mapping.issueNumber,
        })
    }
}

