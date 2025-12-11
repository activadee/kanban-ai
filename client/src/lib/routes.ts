export function getProjectsPath(): string {
    return "/projects";
}

export function getProjectPath(projectId: string): string {
    return `/projects/${encodeURIComponent(projectId)}`;
}

export function getProjectCardPath(
    projectId: string,
    cardId: string | null | undefined,
): string {
    const base = getProjectPath(projectId);
    if (!cardId) return base;
    const search = new URLSearchParams({cardId}).toString();
    return `${base}?${search}`;
}

export function getAttemptPath(attemptId: string): string {
    return `/attempts/${encodeURIComponent(attemptId)}`;
}

export function getDashboardPath(): string {
    return "/dashboard";
}

export function getSettingsPath(): string {
    return "/settings";
}

export function getAgentSettingsPath(agentKey: string): string {
    return `/agents/${encodeURIComponent(agentKey)}`;
}

