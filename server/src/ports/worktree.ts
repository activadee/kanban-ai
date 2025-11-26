import {setWorktreeProvider} from 'core'
import {createWorktree, removeWorktree} from '../fs/worktree-runner'
import {getWorktreePath, getWorktreePathByNames} from '../fs/paths'

export function registerWorktreeProvider() {
    setWorktreeProvider({
        createWorktree,
        removeWorktree,
        getWorktreePath,
        getWorktreePathByNames,
    })
}
