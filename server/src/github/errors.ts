export function toUserGithubError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? '')
    const lower = message.toLowerCase()
    if (lower.includes('not connected') || lower.includes('token')) {
        return 'GitHub is not connected. Connect GitHub and try again.'
    }
    if (lower.includes('origin') || lower.includes('github repo') || lower.includes('unsupported remote')) {
        return 'Project repository is not a GitHub repo or has no origin remote.'
    }
    if (lower.includes('persist') || lower.includes('mapping')) {
        return 'GitHub issue was created, but KanbanAI couldn\'t link it. Please re‑sync later.'
    }
    return 'Failed to create GitHub issue. Check connection and permissions.'
}
