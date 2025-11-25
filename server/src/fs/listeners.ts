import type {AppEventBus} from '../events/bus'
import {getWorktreesRoot, getProjectWorktreeFolder} from './paths'
import {rm} from 'fs/promises'
import {join} from 'path'
import {log} from '../log'

export function registerFsListeners(bus: AppEventBus) {
    bus.subscribe('project.deleted', async ({projectId, projectName}) => {
        try {
            const legacyPath = join(getWorktreesRoot(), projectId)
            await rm(legacyPath, {recursive: true, force: true})

            if (projectName) {
                const namedPath = getProjectWorktreeFolder(projectName)
                await rm(namedPath, {recursive: true, force: true})
            }
        } catch (error) {
            log.error({err: error}, '[fs] failed to cleanup worktrees on project.deleted')
        }
    })
}
