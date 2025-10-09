import simpleGit from 'simple-git'
import type {ProjectBranchInfo} from 'shared'
import {projectsRepo} from 'core'

const {getRepositoryPath: getRepositoryPathFromRepo} = projectsRepo

async function resolveRepositoryPath(projectId: string): Promise<string> {
    const path = await getRepositoryPathFromRepo(projectId)
    if (!path) throw new Error('Project not found')
    return path
}

function normalizeBranchName(raw: string) {
    return raw.replace(/^refs\//, '')
}

export async function listProjectBranches(projectId: string): Promise<ProjectBranchInfo[]> {
    const repoPath = await resolveRepositoryPath(projectId)
    const git = simpleGit({baseDir: repoPath})
    const summary = await git.branch(['-a'])

    const current = summary.current
    const result: ProjectBranchInfo[] = []
    const seen = new Set<string>()

    for (const raw of summary.all) {
        const normalized = normalizeBranchName(raw)
        const isRemote = normalized.startsWith('remotes/')
        if (isRemote) {
            const withoutRemotes = normalized.replace(/^remotes\//, '')
            const [remote, ...rest] = withoutRemotes.split('/')
            if (!remote || rest.length === 0) continue
            const branchName = rest.join('/')
            const key = `remote:${remote}:${branchName}`
            if (seen.has(key)) continue
            seen.add(key)
            result.push({
                name: `${remote}/${branchName}`,
                displayName: `${remote}/${branchName}`,
                kind: 'remote',
                remote,
                isCurrent: Boolean(current && branchName === current && remote === 'origin'),
            })
        } else {
            const key = `local:${normalized}`
            if (seen.has(key)) continue
            seen.add(key)
            result.push({
                name: normalized,
                displayName: normalized,
                kind: 'local',
                isCurrent: normalized === current,
            })
        }
    }

    result.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'local' ? -1 : 1
        return a.displayName.localeCompare(b.displayName)
    })

    return result
}
