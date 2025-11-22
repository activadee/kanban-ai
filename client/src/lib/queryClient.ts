import {QueryClient} from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
        },
    },
})

export const projectsKeys = {
    all: ['projects'] as const,
    list: () => [...projectsKeys.all, 'list'] as const,
    detail: (projectId: string) => [...projectsKeys.all, 'detail', projectId] as const,
    githubOrigin: (projectId: string) => [...projectsKeys.all, 'github-origin', projectId] as const,
    nextTicketKey: (projectId: string) => [...projectsKeys.all, 'next-ticket-key', projectId] as const,
    branches: (projectId: string) => [...projectsKeys.all, 'branches', projectId] as const,
}

export const projectSettingsKeys = {
    all: ['project-settings'] as const,
    detail: (projectId: string) => [...projectSettingsKeys.all, projectId] as const,
}

export const agentKeys = {
    all: ['agents'] as const,
    list: () => [...agentKeys.all, 'list'] as const,
    profiles: (scope: string) => [...agentKeys.all, 'profiles', scope] as const,
}

export const attemptKeys = {
    all: ['attempts'] as const,
    detail: (attemptId: string) => [...attemptKeys.all, attemptId] as const,
    logs: (attemptId: string) => [...attemptKeys.all, attemptId, 'logs'] as const,
    conversation: (attemptId: string) => [...attemptKeys.all, attemptId, 'conversation'] as const,
}

export const cardAttemptKeys = {
    all: ['card-attempt'] as const,
    detail: (projectId: string, cardId: string) => [...cardAttemptKeys.all, projectId, cardId] as const,
}

export const githubKeys = {
    all: ['github'] as const,
    check: () => [...githubKeys.all, 'check'] as const,
    appConfig: () => [...githubKeys.all, 'app-config'] as const,
}

export const filesystemKeys = {
    all: ['filesystem'] as const,
    gitRepos: (path?: string) => [...filesystemKeys.all, 'git-repos', path ?? 'root'] as const,
}

export const dashboardKeys = {
    all: ['dashboard'] as const,
    overview: () => [...dashboardKeys.all, 'overview'] as const,
}

export const onboardingKeys = {
    all: ['onboarding'] as const,
    status: () => [...onboardingKeys.all, 'status'] as const,
}
