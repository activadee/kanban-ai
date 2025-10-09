export type GitRepositoryEntry = {
    name: string
    path: string
}

export type GitRepositoryListResponse = {
    entries: GitRepositoryEntry[]
}
