export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'U' | '?' | 'C'

export type FileChange = {
    path: string
    oldPath?: string
    status: GitFileStatus
    staged: boolean
}

export type GitStatus = {
    branch: string
    ahead: number
    behind: number
    hasUncommitted: boolean
    files: FileChange[]
    summary: {
        added: number
        modified: number
        deleted: number
        untracked: number
        staged: number
    }
}

export type PRInfo = {
    number: number
    url: string
    state: 'open' | 'closed'
    draft: boolean
    title?: string
    headRef?: string
    baseRef?: string
    createdAt?: string
    updatedAt?: string
    merged?: boolean
}
