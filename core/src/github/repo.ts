import {getGithubRepo} from '../repos/provider'
import type {GithubConnectionRow, GithubIssueRow, GithubIssueInsert, GithubAppConfigRow} from '../db/types'
import type {GithubConnectionUpsert, GithubAppConfigUpsert, GithubIssueUpdate, GithubIssueStats} from '../repos/interfaces'

export type {GithubConnectionUpsert, GithubAppConfigUpsert, GithubIssueStats}
export type GithubIssueDirection = 'imported' | 'exported'

export async function getGithubConnection(): Promise<GithubConnectionRow | null> {
    return getGithubRepo().getGithubConnection()
}

export async function upsertGithubConnection(data: GithubConnectionUpsert): Promise<GithubConnectionRow> {
    return getGithubRepo().upsertGithubConnection(data)
}

export async function deleteGithubConnection(): Promise<void> {
    return getGithubRepo().deleteGithubConnection()
}

export async function getGithubAppConfig(): Promise<GithubAppConfigRow | null> {
    return getGithubRepo().getGithubAppConfig()
}

export async function upsertGithubAppConfig(values: GithubAppConfigUpsert): Promise<GithubAppConfigRow> {
    return getGithubRepo().upsertGithubAppConfig(values)
}

export async function findGithubIssueMapping(
    boardId: string,
    owner: string,
    repo: string,
    issueNumber: number,
): Promise<GithubIssueRow | null> {
    return getGithubRepo().findGithubIssueMapping(boardId, owner, repo, issueNumber)
}

export async function insertGithubIssueMapping(values: GithubIssueInsert): Promise<void> {
    return getGithubRepo().insertGithubIssueMapping(values)
}

export async function updateGithubIssueMapping(id: string, patch: GithubIssueUpdate): Promise<void> {
    return getGithubRepo().updateGithubIssueMapping(id, patch)
}

export async function findGithubIssueMappingByCardId(cardId: string): Promise<GithubIssueRow | null> {
    return getGithubRepo().findGithubIssueMappingByCardId(cardId)
}

export async function listGithubIssueMappingsByCardId(cardId: string): Promise<GithubIssueRow[]> {
    return getGithubRepo().listGithubIssueMappingsByCardId(cardId)
}

export async function getGithubIssueStats(boardId: string): Promise<GithubIssueStats> {
    return getGithubRepo().getGithubIssueStats(boardId)
}
