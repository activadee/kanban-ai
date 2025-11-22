export type GitHubAccount = {
    username: string
    primaryEmail: string | null
    scope: string | null
    avatarUrl?: string | null
}

export type GitHubDeviceStartResponse = {
    userCode: string
    verificationUri: string
    verificationUriComplete?: string | null
    expiresIn: number
    interval: number
}

export type GitHubDevicePollResponse =
    | { status: 'authorization_pending' }
    | { status: 'slow_down'; retryAfterSeconds?: number }
    | { status: 'expired' }
    | { status: 'access_denied' }
    | { status: 'error'; message: string }
    | { status: 'success'; account: GitHubAccount }

export type GitHubCheckResponse =
    | { status: 'invalid' }
    | { status: 'valid'; account: GitHubAccount }

// Repos listing (subset)
export type GitHubRepo = {
    id: number
    name: string
    full_name: string
    private: boolean
    html_url: string
    default_branch: string
    owner: { login: string }
}

// Import issues
export type ImportIssuesRequest = {
    owner: string
    repo: string
    state?: 'open' | 'closed' | 'all'
}

export type ImportIssuesResponse = {
    imported: number
    updated: number
    skipped: number
}

export type GitOriginResponse = {
    originUrl: string | null
    owner: string | null
    repo: string | null
}
