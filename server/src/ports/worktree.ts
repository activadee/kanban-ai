import {setWorktreeProvider} from 'core'
import {createWorktree as srvCreate, removeWorktree as srvRemove} from '../fs/worktree'
import {getWorktreePath as p1, getWorktreePathByNames as p2} from '../fs/paths'

export function registerWorktreeProvider() {
    setWorktreeProvider({
        async createWorktree(repoPath, base, branch, outDir, meta) {
            return srvCreate(repoPath, base, branch, outDir, meta)
        },
        async removeWorktree(repoPath, worktreePath, meta) {
            return srvRemove(repoPath, worktreePath, meta)
        },
        getWorktreePath(projectId, attemptId) {
            return p1(projectId, attemptId)
        },
        getWorktreePathByNames(projectName, taskName) {
            return p2(projectName, taskName)
        },
    })
}
